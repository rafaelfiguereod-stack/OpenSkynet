export class ContainerManager {
  private containers: Map<
    string,
    { id: string; status: string; image: string }
  > = new Map();

  async start(
    image = "ubuntu:22.04",
  ): Promise<{ id: string; status: string }> {
    const id = `container_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const entry = { id, status: "running", image };
    this.containers.set(id, entry);
    return { id, status: "running" };
  }

  async stop(id: string): Promise<void> {
    const entry = this.containers.get(id);
    if (entry) {
      entry.status = "stopped";
    }
  }

  async execute(
    id: string,
    command: string,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const entry = this.containers.get(id);
    if (!entry || entry.status !== "running") {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `Container ${id} not found or not running`,
      };
    }
    return {
      exitCode: 0,
      stdout: `Executed: ${command}`,
      stderr: "",
    };
  }
}
