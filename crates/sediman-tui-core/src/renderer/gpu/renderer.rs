use std::num::NonZeroU64;
use std::sync::Arc;

use wgpu::util::{DeviceExt, BufferInitDescriptor};
use wgpu::*;

use crate::renderer::CellBuffer;
use crate::renderer::Color;
use crate::renderer::diff::DiffEngine;
use crate::styling::Theme;

use super::atlas::{FontAtlas, FontAtlasConfig};

const DEFAULT_MAX_VERTICES: u64 = 512 * 1024;
const DEFAULT_MAX_INDICES: u64 = 768 * 1024;

const VERTEX_FLAG_BACKGROUND: f32 = 0.0;
const VERTEX_FLAG_GLYPH: f32 = 1.0;

pub(crate) fn wgpu_color(rgba: [f32; 4]) -> wgpu::Color {
    wgpu::Color {
        r: rgba[0] as f64,
        g: rgba[1] as f64,
        b: rgba[2] as f64,
        a: rgba[3] as f64,
    }
}

const WGSL_SHADER: &str = r#"
struct VertexInput {
    @location(0) pos: vec2<f32>,
    @location(1) uv: vec2<f32>,
    @location(2) fg: vec4<f32>,
    @location(3) bg: vec4<f32>,
    @location(4) flags: f32,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) fg: vec4<f32>,
    @location(2) bg: vec4<f32>,
    @location(3) flags: f32,
}

struct Uniforms {
    screen_w: f32,
    screen_h: f32,
    cell_w: f32,
    cell_h: f32,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var t: texture_2d<f32>;
@group(0) @binding(2) var s: sampler;

@vertex
fn vs(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.position = vec4f(
        (in.pos.x / u.screen_w) * 2.0 - 1.0,
        1.0 - (in.pos.y / u.screen_h) * 2.0,
        0.0, 1.0
    );
    out.uv = in.uv;
    out.fg = in.fg;
    out.bg = in.bg;
    out.flags = in.flags;
    return out;
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
    let is_bg = in.flags < 0.5;
    if is_bg {
        return in.bg;
    }
    let a = textureSample(t, s, in.uv).r;
    let fg = in.fg * a;
    let bg = in.bg * (1.0 - a);
    return vec4f(fg.rgb + bg.rgb, 1.0);
}
"#;

#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
struct GpuVertex {
    pos: [f32; 2],
    uv: [f32; 2],
    fg: [f32; 4],
    bg: [f32; 4],
    flags: f32,
}

impl GpuVertex {
    const LAYOUT: VertexBufferLayout<'static> = VertexBufferLayout {
        array_stride: std::mem::size_of::<GpuVertex>() as u64,
        step_mode: VertexStepMode::Vertex,
        attributes: &[
            VertexAttribute { offset: 0, format: VertexFormat::Float32x2, shader_location: 0 },
            VertexAttribute { offset: 8, format: VertexFormat::Float32x2, shader_location: 1 },
            VertexAttribute { offset: 16, format: VertexFormat::Float32x4, shader_location: 2 },
            VertexAttribute { offset: 32, format: VertexFormat::Float32x4, shader_location: 3 },
            VertexAttribute { offset: 48, format: VertexFormat::Float32, shader_location: 4 },
        ],
    };
}

#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
struct GpuUniforms {
    screen_w: f32,
    screen_h: f32,
    cell_w: f32,
    cell_h: f32,
}

pub struct GpuRendererConfig {
    pub font_size: f32,
    pub max_vertices: u64,
    pub max_indices: u64,
    pub atlas_config: FontAtlasConfig,
    pub theme: Theme,
}

impl Default for GpuRendererConfig {
    fn default() -> Self {
        Self {
            font_size: 16.0,
            max_vertices: DEFAULT_MAX_VERTICES,
            max_indices: DEFAULT_MAX_INDICES,
            atlas_config: FontAtlasConfig::default(),
            theme: Theme::default(),
        }
    }
}

pub struct GpuRenderer {
    surface: Surface<'static>,
    device: Device,
    queue: Queue,
    config: SurfaceConfiguration,
    pipeline: RenderPipeline,
    atlas: FontAtlas,
    #[allow(dead_code)]
    glyph_texture: Texture,
    glyph_bind_group: BindGroup,
    uniform_buffer: Buffer,
    prev_buffer: CellBuffer,
    vertex_buf: Buffer,
    index_buf: Buffer,
    bg_color: Color,
    fg_color: Color,
    cell_w: f32,
    cell_h: f32,
    max_vertices: u64,
    max_indices: u64,
}

fn build_vertex_data(
    atlas: &FontAtlas,
    changes: &[crate::renderer::diff::Change],
    cell_w: f32,
    cell_h: f32,
    default_fg: [f32; 4],
    default_bg: [f32; 4],
) -> (Vec<GpuVertex>, Vec<u32>) {
    let mut vertices: Vec<GpuVertex> = Vec::with_capacity(changes.len() * 8);
    let mut indices: Vec<u32> = Vec::with_capacity(changes.len() * 12);

    for change in changes {
        let col = change.x as f32;
        let row = change.y as f32;
        let x0 = col * cell_w;
        let y0 = row * cell_h;
        let x1 = x0 + cell_w;
        let y1 = y0 + cell_h;

        let fg = change.cell.style.fg.map_or(default_fg, FontAtlas::color_to_f32);
        let bg = change.cell.style.bg.map_or(default_bg, FontAtlas::color_to_f32);

        let base = vertices.len() as u32;
        vertices.extend_from_slice(&[
            GpuVertex { pos: [x0, y0], uv: [0.0, 0.0], fg, bg, flags: VERTEX_FLAG_BACKGROUND },
            GpuVertex { pos: [x1, y0], uv: [1.0, 0.0], fg, bg, flags: VERTEX_FLAG_BACKGROUND },
            GpuVertex { pos: [x1, y1], uv: [1.0, 1.0], fg, bg, flags: VERTEX_FLAG_BACKGROUND },
            GpuVertex { pos: [x0, y1], uv: [0.0, 1.0], fg, bg, flags: VERTEX_FLAG_BACKGROUND },
        ]);
        indices.extend_from_slice(&[base, base + 1, base + 2, base, base + 2, base + 3]);

        if change.cell.ch != ' ' && change.cell.ch != '\0' {
            let glyph = *atlas.get_or_fallback(change.cell.ch);
            let base = vertices.len() as u32;
            vertices.extend_from_slice(&[
                GpuVertex { pos: [x0, y0], uv: [glyph.u0, glyph.v0], fg, bg, flags: VERTEX_FLAG_GLYPH },
                GpuVertex { pos: [x1, y0], uv: [glyph.u1, glyph.v0], fg, bg, flags: VERTEX_FLAG_GLYPH },
                GpuVertex { pos: [x1, y1], uv: [glyph.u1, glyph.v1], fg, bg, flags: VERTEX_FLAG_GLYPH },
                GpuVertex { pos: [x0, y1], uv: [glyph.u0, glyph.v1], fg, bg, flags: VERTEX_FLAG_GLYPH },
            ]);
            indices.extend_from_slice(&[base, base + 1, base + 2, base, base + 2, base + 3]);
        }
    }

    (vertices, indices)
}

fn compute_diff(prev: &CellBuffer, new: &CellBuffer) -> Vec<crate::renderer::diff::Change> {
    if prev.width() == new.width() && prev.height() == new.height() {
        DiffEngine::diff(prev, new)
    } else {
        let fresh = CellBuffer::new(new.width(), new.height());
        DiffEngine::diff(&fresh, new)
    }
}

impl GpuRenderer {
    pub async fn new(
        window: Arc<winit::window::Window>,
        font_data: &[u8],
        config: GpuRendererConfig,
    ) -> Self {
        let size = window.inner_size();
        let w = size.width.max(1);
        let h = size.height.max(1);

        let instance = Instance::new(&InstanceDescriptor::default());
        let surface = instance.create_surface(Arc::clone(&window))
            .expect("Failed to create GPU surface — no compatible display available");

        let adapter = instance
            .request_adapter(&RequestAdapterOptions {
                power_preference: PowerPreference::HighPerformance,
                compatible_surface: Some(&surface),
                force_fallback_adapter: false,
            })
            .await
            .expect("Failed to get GPU adapter — no compatible GPU found");

        let (device, queue) = adapter
            .request_device(
                &DeviceDescriptor {
                    label: Some("sediman-gpu"),
                    required_features: Features::empty(),
                    required_limits: Limits::default(),
                    memory_hints: MemoryHints::Performance,
                },
                None,
            )
            .await
            .expect("Failed to get GPU device — driver issue or insufficient resources");

        let caps = surface.get_capabilities(&adapter);
        let format = caps
            .formats
            .iter()
            .find(|f| f.is_srgb())
            .copied()
            .unwrap_or(caps.formats[0]);

        let surface_config = SurfaceConfiguration {
            usage: TextureUsages::RENDER_ATTACHMENT,
            format,
            width: w,
            height: h,
            present_mode: PresentMode::AutoNoVsync,
            desired_maximum_frame_latency: 1,
            alpha_mode: caps.alpha_modes[0],
            view_formats: vec![],
        };
        surface.configure(&device, &surface_config);

        let atlas = FontAtlas::with_config(font_data, config.font_size, config.atlas_config);
        let cell_w = atlas.cell_width();
        let cell_h = atlas.line_height();

        let atlas_size = Extent3d {
            width: atlas.width(),
            height: atlas.height(),
            depth_or_array_layers: 1,
        };
        let glyph_texture = device.create_texture(&TextureDescriptor {
            label: Some("glyph-atlas"),
            size: atlas_size,
            mip_level_count: 1,
            sample_count: 1,
            dimension: TextureDimension::D2,
            format: TextureFormat::Rgba8Unorm,
            usage: TextureUsages::TEXTURE_BINDING | TextureUsages::COPY_DST,
            view_formats: &[],
        });
        queue.write_texture(
            TexelCopyTextureInfo {
                texture: &glyph_texture,
                mip_level: 0,
                origin: Origin3d::ZERO,
                aspect: TextureAspect::All,
            },
            atlas.pixels(),
            TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(atlas.width() * 4),
                rows_per_image: Some(atlas.height()),
            },
            atlas_size,
        );

        let glyph_view = glyph_texture.create_view(&TextureViewDescriptor::default());
        let glyph_sampler = device.create_sampler(&SamplerDescriptor {
            address_mode_u: AddressMode::ClampToEdge,
            address_mode_v: AddressMode::ClampToEdge,
            address_mode_w: AddressMode::ClampToEdge,
            mag_filter: FilterMode::Linear,
            min_filter: FilterMode::Linear,
            ..Default::default()
        });

        let uniforms = GpuUniforms { screen_w: w as f32, screen_h: h as f32, cell_w: 0.0, cell_h: 0.0 };
        let uniform_buffer = device.create_buffer_init(&BufferInitDescriptor {
            label: Some("uniforms"),
            contents: bytemuck::cast_slice(&[uniforms]),
            usage: BufferUsages::UNIFORM | BufferUsages::COPY_DST,
        });

        let bind_group_layout = device.create_bind_group_layout(&BindGroupLayoutDescriptor {
            label: Some("bg-layout"),
            entries: &[
                BindGroupLayoutEntry {
                    binding: 0,
                    visibility: ShaderStages::VERTEX | ShaderStages::FRAGMENT,
                    ty: BindingType::Buffer {
                        ty: BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: NonZeroU64::new(std::mem::size_of::<GpuUniforms>() as u64),
                    },
                    count: None,
                },
                BindGroupLayoutEntry {
                    binding: 1,
                    visibility: ShaderStages::FRAGMENT,
                    ty: BindingType::Texture {
                        sample_type: TextureSampleType::Float { filterable: true },
                        view_dimension: TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                BindGroupLayoutEntry {
                    binding: 2,
                    visibility: ShaderStages::FRAGMENT,
                    ty: BindingType::Sampler(SamplerBindingType::Filtering),
                    count: None,
                },
            ],
        });

        let glyph_bind_group = device.create_bind_group(&BindGroupDescriptor {
            label: Some("glyph-bg"),
            layout: &bind_group_layout,
            entries: &[
                BindGroupEntry { binding: 0, resource: uniform_buffer.as_entire_binding() },
                BindGroupEntry { binding: 1, resource: BindingResource::TextureView(&glyph_view) },
                BindGroupEntry { binding: 2, resource: BindingResource::Sampler(&glyph_sampler) },
            ],
        });

        let pipeline_layout = device.create_pipeline_layout(&PipelineLayoutDescriptor {
            label: Some("pipeline-layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });

        let shader = device.create_shader_module(ShaderModuleDescriptor {
            label: Some("shader"),
            source: ShaderSource::Wgsl(WGSL_SHADER.into()),
        });

        let pipeline = device.create_render_pipeline(&RenderPipelineDescriptor {
            label: Some("pipeline"),
            layout: Some(&pipeline_layout),
            vertex: VertexState {
                module: &shader,
                entry_point: Some("vs"),
                buffers: &[GpuVertex::LAYOUT],
                compilation_options: Default::default(),
            },
            fragment: Some(FragmentState {
                module: &shader,
                entry_point: Some("fs"),
                targets: &[Some(ColorTargetState {
                    format: surface_config.format,
                    blend: Some(BlendState::ALPHA_BLENDING),
                    write_mask: ColorWrites::ALL,
                })],
                compilation_options: Default::default(),
            }),
            primitive: PrimitiveState {
                topology: PrimitiveTopology::TriangleList,
                ..Default::default()
            },
            depth_stencil: None,
            multisample: MultisampleState::default(),
            multiview: None,
            cache: None,
        });

        let max_vertices = config.max_vertices;
        let max_indices = config.max_indices;

        let vertex_buf = device.create_buffer(&BufferDescriptor {
            label: Some("vertex-pool"),
            size: max_vertices * std::mem::size_of::<GpuVertex>() as u64,
            usage: BufferUsages::VERTEX | BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let index_buf = device.create_buffer(&BufferDescriptor {
            label: Some("index-pool"),
            size: max_indices * 4,
            usage: BufferUsages::INDEX | BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let bg_color = config.theme.background;
        let fg_color = config.theme.text;

        Self {
            surface,
            device,
            queue,
            config: surface_config,
            pipeline,
            atlas,
            glyph_texture,
            glyph_bind_group,
            uniform_buffer,
            prev_buffer: CellBuffer::empty(),
            vertex_buf,
            index_buf,
            bg_color,
            fg_color,
            cell_w,
            cell_h,
            max_vertices,
            max_indices,
        }
    }

    pub fn resize(&mut self, width: u32, height: u32) {
        if width > 0 && height > 0 {
            self.config.width = width;
            self.config.height = height;
            self.surface.configure(&self.device, &self.config);
        }
    }

    pub fn set_bg_color(&mut self, color: Color) {
        self.bg_color = color;
    }

    pub fn set_fg_color(&mut self, color: Color) {
        self.fg_color = color;
    }

    pub fn set_theme(&mut self, theme: &Theme) {
        self.bg_color = theme.background;
        self.fg_color = theme.text;
    }

    pub fn cell_dimensions(&self) -> (f32, f32) {
        (self.cell_w, self.cell_h)
    }

    pub fn atlas(&self) -> &FontAtlas {
        &self.atlas
    }

    pub fn atlas_mut(&mut self) -> &mut FontAtlas {
        &mut self.atlas
    }

    fn update_uniforms(&mut self, cell_w: f32, cell_h: f32) {
        let uniforms = GpuUniforms {
            screen_w: self.config.width as f32,
            screen_h: self.config.height as f32,
            cell_w,
            cell_h,
        };
        self.queue.write_buffer(&self.uniform_buffer, 0, bytemuck::cast_slice(&[uniforms]));
    }

    fn compute_changes(&mut self, buffer: &CellBuffer) -> Vec<crate::renderer::diff::Change> {
        let changes = compute_diff(&self.prev_buffer, buffer);
        self.prev_buffer = buffer.clone();
        changes
    }

    fn build_vertices(
        &mut self,
        changes: &[crate::renderer::diff::Change],
        cell_w: f32,
        cell_h: f32,
    ) -> (Vec<GpuVertex>, Vec<u32>) {
        let default_fg = FontAtlas::color_to_f32(self.fg_color);
        let default_bg = FontAtlas::color_to_f32(self.bg_color);
        let (vertices, indices) = build_vertex_data(
            &self.atlas, changes, cell_w, cell_h, default_fg, default_bg,
        );
        self.upload_atlas_dirty();
        (vertices, indices)
    }

    fn upload_atlas_dirty(&mut self) {
        let dirty = match self.atlas.take_dirty_rect() {
            Some(d) => d,
            None => return,
        };
        let (rx, ry, rw, rh) = dirty;
        let atlas_width = self.atlas.width();
        let atlas_pixels = self.atlas.pixels();
        let row_bytes = atlas_width as usize * 4;
        let sub_data: Vec<u8> = (ry..rh).flat_map(|row| {
            let start = (row as usize * row_bytes) + (rx as usize * 4);
            atlas_pixels[start..start + (rw - rx) as usize * 4].iter().copied()
        }).collect();
        self.queue.write_texture(
            TexelCopyTextureInfo {
                texture: &self.glyph_texture,
                mip_level: 0,
                origin: Origin3d { x: rx, y: ry, z: 0 },
                aspect: TextureAspect::All,
            },
            &sub_data,
            TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some((rw - rx) * 4),
                rows_per_image: Some(rh - ry),
            },
            Extent3d {
                width: rw - rx,
                height: rh - ry,
                depth_or_array_layers: 1,
            },
        );
    }

    fn submit_frame(
        &mut self,
        vertices: &[GpuVertex],
        indices: &[u32],
    ) -> Result<(), SurfaceError> {
        if !vertices.is_empty() {
            let vert_count = vertices.len() as u64;
            let idx_count = indices.len() as u64;
            if vert_count > self.max_vertices || idx_count > self.max_indices {
                return Ok(());
            }
            self.queue.write_buffer(&self.vertex_buf, 0, bytemuck::cast_slice(vertices));
            self.queue.write_buffer(&self.index_buf, 0, bytemuck::cast_slice(indices));
        }

        let output = self.surface.get_current_texture()?;
        let view = output.texture.create_view(&TextureViewDescriptor::default());

        let bg_f32 = FontAtlas::color_to_f32(self.bg_color);
        let mut encoder = self.device.create_command_encoder(&CommandEncoderDescriptor { label: None });
        {
            let mut pass = encoder.begin_render_pass(&RenderPassDescriptor {
                label: None,
                color_attachments: &[Some(RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    ops: Operations {
                        load: LoadOp::Clear(wgpu_color(bg_f32)),
                        store: StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
            });

            if !indices.is_empty() {
                pass.set_pipeline(&self.pipeline);
                pass.set_bind_group(0, &self.glyph_bind_group, &[]);
                pass.set_vertex_buffer(0, self.vertex_buf.slice(..));
                pass.set_index_buffer(self.index_buf.slice(..), IndexFormat::Uint32);
                pass.draw_indexed(0..indices.len() as u32, 0, 0..1);
            }
        }

        self.queue.submit([encoder.finish()]);
        output.present();

        Ok(())
    }

    pub fn render(&mut self, buffer: &CellBuffer, cell_w: f32, cell_h: f32) -> Result<(), SurfaceError> {
        self.update_uniforms(cell_w, cell_h);
        let changes = self.compute_changes(buffer);
        let (vertices, indices) = self.build_vertices(&changes, cell_w, cell_h);
        self.submit_frame(&vertices, &indices)
    }

    pub fn full_redraw(&mut self, buffer: &CellBuffer, cell_w: f32, cell_h: f32) -> Result<(), SurfaceError> {
        self.prev_buffer = CellBuffer::empty();
        self.render(buffer, cell_w, cell_h)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::renderer::{Cell, Style};
    use crate::renderer::diff::Change;

    fn load_test_atlas() -> FontAtlas {
        let font_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures/DejaVuSansMono.ttf");
        let font_data = std::fs::read(&font_path)
            .unwrap_or_else(|_| panic!("Test font not found at {:?}", font_path));
        FontAtlas::with_config(&font_data, 16.0, FontAtlasConfig::default())
    }

    fn cell(ch: char) -> Cell {
        let mut c = Cell::default();
        c.ch = ch;
        c
    }

    fn styled_cell(ch: char, style: Style) -> Cell {
        let mut c = Cell::default();
        c.ch = ch;
        c.style = style;
        c
    }

    #[test]
    fn test_wgpu_color_conversion() {
        let rgba = [0.5, 0.25, 0.75, 1.0];
        let c = wgpu_color(rgba);
        assert!((c.r - 0.5).abs() < f64::EPSILON);
        assert!((c.g - 0.25).abs() < f64::EPSILON);
        assert!((c.b - 0.75).abs() < f64::EPSILON);
        assert!((c.a - 1.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_wgpu_color_zero_and_one() {
        let zero = wgpu_color([0.0, 0.0, 0.0, 0.0]);
        assert_eq!(zero.r, 0.0);
        assert_eq!(zero.a, 0.0);
        let one = wgpu_color([1.0, 1.0, 1.0, 1.0]);
        assert_eq!(one.r, 1.0);
        assert_eq!(one.a, 1.0);
    }

    #[test]
    fn test_gpu_renderer_config_defaults() {
        let config = GpuRendererConfig::default();
        assert_eq!(config.font_size, 16.0);
        assert_eq!(config.max_vertices, DEFAULT_MAX_VERTICES);
        assert_eq!(config.max_indices, DEFAULT_MAX_INDICES);
    }

    #[test]
    fn test_gpu_vertex_size() {
        assert_eq!(std::mem::size_of::<GpuVertex>(), 52);
    }

    #[test]
    fn test_compute_diff_same_size() {
        let w = 10u16;
        let h = 5u16;
        let mut prev = CellBuffer::new(w, h);
        prev.get_mut(3, 2).unwrap().ch = 'A';
        let mut new = CellBuffer::new(w, h);
        new.get_mut(3, 2).unwrap().ch = 'B';
        new.get_mut(7, 4).unwrap().ch = 'C';
        let changes = compute_diff(&prev, &new);
        let positions: Vec<(u16, u16)> = changes.iter().map(|c| (c.x, c.y)).collect();
        assert!(positions.contains(&(3, 2)), "Should detect changed cell");
        assert!(positions.contains(&(7, 4)), "Should detect new cell");
    }

    #[test]
    fn test_compute_diff_different_size() {
        let prev = CellBuffer::new(10, 5);
        let mut new = CellBuffer::new(8, 3);
        new.get_mut(0, 0).unwrap().ch = 'X';
        let changes = compute_diff(&prev, &new);
        assert!(!changes.is_empty(), "Should produce changes when sizes differ");
        let positions: Vec<(u16, u16)> = changes.iter().map(|c| (c.x, c.y)).collect();
        assert!(positions.contains(&(0, 0)), "Should detect cell in new buffer");
    }

    #[test]
    fn test_compute_diff_identical() {
        let buf = CellBuffer::new(10, 5);
        let changes = compute_diff(&buf, &buf);
        assert!(changes.is_empty(), "Identical buffers should produce no changes");
    }

    #[test]
    fn test_build_vertex_data_background_only() {
        let atlas = load_test_atlas();
        let changes = vec![Change { x: 0, y: 0, cell: cell(' ') }];
        let cell_w = atlas.cell_width();
        let cell_h = atlas.line_height();
        let default_fg = [1.0, 1.0, 1.0, 1.0];
        let default_bg = [0.0, 0.0, 0.0, 1.0];
        let (vertices, indices) = build_vertex_data(&atlas, &changes, cell_w, cell_h, default_fg, default_bg);
        assert_eq!(vertices.len(), 4, "Space char should produce only background quad");
        assert_eq!(indices.len(), 6);
        for v in &vertices {
            assert_eq!(v.flags, VERTEX_FLAG_BACKGROUND);
        }
    }

    #[test]
    fn test_build_vertex_data_with_glyph() {
        let atlas = load_test_atlas();
        let changes = vec![Change { x: 2, y: 3, cell: cell('A') }];
        let cell_w = atlas.cell_width();
        let cell_h = atlas.line_height();
        let default_fg = [1.0, 1.0, 1.0, 1.0];
        let default_bg = [0.0, 0.0, 0.0, 1.0];
        let (vertices, indices) = build_vertex_data(&atlas, &changes, cell_w, cell_h, default_fg, default_bg);
        assert_eq!(vertices.len(), 8, "Non-space char should produce bg + glyph quad");
        assert_eq!(indices.len(), 12);
        assert_eq!(vertices[0].flags, VERTEX_FLAG_BACKGROUND);
        assert_eq!(vertices[4].flags, VERTEX_FLAG_GLYPH);
        assert!(vertices[4].uv[0] > 0.0 || vertices[4].uv[1] > 0.0,
            "Glyph vertices should have atlas UVs");
    }

    #[test]
    fn test_build_vertex_data_position_math() {
        let atlas = load_test_atlas();
        let cell_w = 10.0_f32;
        let cell_h = 20.0_f32;
        let changes = vec![Change { x: 5, y: 3, cell: cell(' ') }];
        let default_fg = [1.0, 1.0, 1.0, 1.0];
        let default_bg = [0.0, 0.0, 0.0, 1.0];
        let (vertices, _) = build_vertex_data(&atlas, &changes, cell_w, cell_h, default_fg, default_bg);
        assert_eq!(vertices[0].pos[0], 50.0, "x0 = col * cell_w");
        assert_eq!(vertices[0].pos[1], 60.0, "y0 = row * cell_h");
        assert_eq!(vertices[2].pos[0], 60.0, "x1 = x0 + cell_w");
        assert_eq!(vertices[2].pos[1], 80.0, "y1 = y0 + cell_h");
    }

    #[test]
    fn test_build_vertex_data_custom_colors() {
        let atlas = load_test_atlas();
        let fg = Color::from_hex("#ff0000").unwrap();
        let bg = Color::from_hex("#0000ff").unwrap();
        let changes = vec![Change { x: 0, y: 0, cell: styled_cell('X', Style::new().fg(fg).bg(bg)) }];
        let cell_w = atlas.cell_width();
        let cell_h = atlas.line_height();
        let default_fg = [1.0, 1.0, 1.0, 1.0];
        let default_bg = [0.0, 0.0, 0.0, 1.0];
        let (vertices, _) = build_vertex_data(&atlas, &changes, cell_w, cell_h, default_fg, default_bg);
        let fg_f32 = FontAtlas::color_to_f32(fg);
        let bg_f32 = FontAtlas::color_to_f32(bg);
        assert_eq!(vertices[0].fg, fg_f32, "Vertex fg should match cell style fg");
        assert_eq!(vertices[0].bg, bg_f32, "Vertex bg should match cell style bg");
    }

    #[test]
    fn test_build_vertex_data_skips_null_char() {
        let atlas = load_test_atlas();
        let changes = vec![Change { x: 0, y: 0, cell: cell('\0') }];
        let cell_w = atlas.cell_width();
        let cell_h = atlas.line_height();
        let default_fg = [1.0, 1.0, 1.0, 1.0];
        let default_bg = [0.0, 0.0, 0.0, 1.0];
        let (vertices, indices) = build_vertex_data(&atlas, &changes, cell_w, cell_h, default_fg, default_bg);
        assert_eq!(vertices.len(), 4, "Null char should produce only background quad");
        assert_eq!(indices.len(), 6);
    }

    #[test]
    fn test_build_vertex_data_multiple_changes() {
        let atlas = load_test_atlas();
        let changes = vec![
            Change { x: 0, y: 0, cell: cell('H') },
            Change { x: 1, y: 0, cell: cell('i') },
            Change { x: 2, y: 0, cell: cell('!') },
        ];
        let cell_w = atlas.cell_width();
        let cell_h = atlas.line_height();
        let default_fg = [1.0, 1.0, 1.0, 1.0];
        let default_bg = [0.0, 0.0, 0.0, 1.0];
        let (vertices, indices) = build_vertex_data(&atlas, &changes, cell_w, cell_h, default_fg, default_bg);
        assert_eq!(vertices.len(), 24, "3 glyph changes = 3 * 8 vertices");
        assert_eq!(indices.len(), 36, "3 glyph changes = 3 * 12 indices");
    }

    #[test]
    fn test_build_vertex_data_empty_changes() {
        let atlas = load_test_atlas();
        let changes: Vec<Change> = vec![];
        let default_fg = [1.0, 1.0, 1.0, 1.0];
        let default_bg = [0.0, 0.0, 0.0, 1.0];
        let (vertices, indices) = build_vertex_data(&atlas, &changes, 10.0, 20.0, default_fg, default_bg);
        assert!(vertices.is_empty());
        assert!(indices.is_empty());
    }
}
