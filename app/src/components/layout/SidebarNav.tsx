import { LayoutList, Bot, Puzzle, FileText, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';

const navItems = [
  { id: 'tasks' as const, label: 'Tasks', icon: LayoutList },
  { id: 'agent' as const, label: 'Agent', icon: Bot },
  { id: 'skills' as const, label: 'Skills', icon: Puzzle },
  { id: 'logs' as const, label: 'Logs', icon: FileText },
  { id: 'settings' as const, label: 'Settings', icon: Settings },
];

export function SidebarNav() {
  const currentPage = useAppStore((state) => state.currentPage);
  const setCurrentPage = useAppStore((state) => state.setCurrentPage);

  return (
    <div className="space-y-0.5">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentPage === item.id;

        return (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={cn(
              'group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl',
              'text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-black text-white shadow-md scale-[1.02]'
                : 'text-gray-700 hover:bg-gray-100'
            )}
          >
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200',
              isActive
                ? 'bg-white/20'
                : 'bg-gray-100 group-hover:bg-white'
            )}>
              <Icon className="w-4 h-4" />
            </div>
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
