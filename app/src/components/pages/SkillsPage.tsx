import { useState } from 'react';
import { Download, Trash2, Search, Package, Star, Zap, Check } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shared/Card';
import { ScrollArea } from '@/components/shared/ScrollArea';
import { type Skill } from '@/types';
import { cn } from '@/lib/utils';

const mockSkills: Skill[] = [
  {
    id: '1',
    name: 'web-search',
    description: 'Search the web for information using multiple search engines',
    version: '1.0.0',
    author: 'OpenSkynet',
    installed: true,
    tags: ['search', 'web', 'automation'],
  },
  {
    id: '2',
    name: 'browser-automation',
    description: 'Automate browser interactions with smart element detection',
    version: '1.2.0',
    author: 'OpenSkynet',
    installed: true,
    tags: ['browser', 'automation', 'playwright'],
  },
  {
    id: '3',
    name: 'data-extraction',
    description: 'Extract structured data from web pages using AI',
    version: '0.9.0',
    author: 'Community',
    installed: false,
    tags: ['extraction', 'data', 'ai'],
  },
  {
    id: '4',
    name: 'form-filler',
    description: 'Automatically fill web forms with given data',
    version: '1.0.1',
    author: 'OpenSkynet',
    installed: true,
    tags: ['forms', 'automation'],
  },
];

export function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>(mockSkills);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'installed' | 'available'>('all');

  const filteredSkills = skills.filter((skill) => {
    const matchesSearch =
      skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      filter === 'all' ||
      (filter === 'installed' && skill.installed) ||
      (filter === 'available' && !skill.installed);

    return matchesSearch && matchesFilter;
  });

  const handleInstall = (skillId: string) => {
    setSkills((prev) =>
      prev.map((skill) =>
        skill.id === skillId ? { ...skill, installed: true } : skill
      )
    );
  };

  const handleUninstall = (skillId: string) => {
    setSkills((prev) =>
      prev.map((skill) =>
        skill.id === skillId ? { ...skill, installed: false } : skill
      )
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-white/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-black to-gray-800 flex items-center justify-center shadow-lg">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">Skills</h1>
            <p className="text-xs text-gray-500">Extend OpenSkynet capabilities</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full">
          <Package className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">{skills.length}</span>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="p-6 border-b border-gray-200 bg-white space-y-4">
        <div className="relative max-w-3xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search skills..."
            className="pl-9 h-10 rounded-xl border-gray-300 shadow-sm"
          />
        </div>

        <div className="flex gap-2 max-w-3xl mx-auto">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className={filter === 'all' ? 'bg-black text-white' : 'bg-white'}
          >
            All ({skills.length})
          </Button>
          <Button
            variant={filter === 'installed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('installed')}
            className={filter === 'installed' ? 'bg-black text-white' : 'bg-white'}
          >
            Installed ({skills.filter((s) => s.installed).length})
          </Button>
          <Button
            variant={filter === 'available' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('available')}
            className={filter === 'available' ? 'bg-black text-white' : 'bg-white'}
          >
            Available ({skills.filter((s) => !s.installed).length})
          </Button>
        </div>
      </div>

      {/* Skills Grid */}
      <ScrollArea className="flex-1">
        <div className="max-w-5xl mx-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSkills.map((skill) => (
              <Card key={skill.id} className="border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                        <Package className="w-6 h-6 text-gray-700" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{skill.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            v{skill.version}
                          </span>
                          {skill.installed && (
                            <Star className="w-3.5 h-3.5 text-yellow-500 fill="currentColor" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <CardDescription className="text-sm line-clamp-2 mt-2">
                    {skill.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {skill.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md border border-gray-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Author */}
                  {skill.author && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <span>by</span>
                      <span className="font-medium text-gray-700">{skill.author}</span>
                    </div>
                  )}

                  {/* Action Button */}
                  <Button
                    variant={skill.installed ? 'outline' : 'default'}
                    size="sm"
                    className="w-full rounded-xl py-2.5 transition-all duration-200"
                    onClick={() =>
                      skill.installed
                        ? handleUninstall(skill.id)
                        : handleInstall(skill.id)
                    }
                  >
                    {skill.installed ? (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Uninstall
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Install
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredSkills.length === 0 && (
            <div className="text-center py-16">
              <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">No skills found matching your criteria</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
