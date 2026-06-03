import { useState } from 'react';
import { Play, Square, Sparkles } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shared/Card';
import { ScrollArea } from '@/components/shared/ScrollArea';
import { useTaskStore } from '@/stores/useTaskStore';
import { getChatService } from '@/services/chatService';
import { cn } from '@/lib/utils';

export function TasksPage() {
  const tasks = useTaskStore((state) => state.tasks);
  const activeTask = useTaskStore((state) => state.activeTask);
  const addTask = useTaskStore((state) => state.addTask);
  const updateTask = useTaskStore((state) => state.updateTask);
  const setActiveTask = useTaskStore((state) => state.setActiveTask);

  const [taskInput, setTaskInput] = useState('');

  const handleRunTask = async () => {
    if (!taskInput.trim()) return;

    const task = addTask({
      description: taskInput,
      status: 'running',
    });

    setActiveTask(task);
    setTaskInput('');

    try {
      const chatService = getChatService();
      let result = '';

      await chatService.runTask(task.description, {
        onChunk: (delta) => {
          result += delta;
          updateTask(task.id, { result });
        },
        onDone: () => {
          updateTask(task.id, {
            status: 'completed',
            completedAt: new Date(),
          });
        },
        onError: (error) => {
          updateTask(task.id, {
            status: 'failed',
            result: error,
          });
        },
      });
    } catch (error) {
      updateTask(task.id, {
        status: 'failed',
        result: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    setActiveTask(null);
  };

  const handleStopTask = () => {
    if (activeTask) {
      getChatService().stopCurrentTask();
      updateTask(activeTask.id, { status: 'failed' });
      setActiveTask(null);
    }
  };

  const getStatusStyles = (status: string) => {
    const base = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium';
    switch (status) {
      case 'running':
        return `${base} bg-blue-50 text-blue-700 border border-blue-200`;
      case 'completed':
        return `${base} bg-green-50 text-green-700 border border-green-200`;
      case 'failed':
        return `${base} bg-red-50 text-red-700 border border-red-200`;
      default:
        return `${base} bg-gray-100 text-gray-700 border border-gray-200`;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="h-16 border-b border-gray-200 flex items-center px-6 bg-white/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-black to-gray-800 flex items-center justify-center shadow-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">Tasks</h1>
            <p className="text-xs text-gray-500">Run one-shot browser automation</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Task Input */}
        <div className="p-6 border-b border-gray-200 bg-white">
          <div className="flex gap-3 max-w-3xl mx-auto">
            <Input
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRunTask();
              }}
              placeholder="What should OpenSkynet do? (e.g., 'search for laptops on Amazon and find top 3')"
              disabled={!!activeTask}
              className="flex-1 h-11 rounded-xl border-gray-300 px-4 text-sm focus:ring-2 focus:ring-black/5 transition-all shadow-sm"
            />
            {activeTask ? (
              <Button
                variant="destructive"
                onClick={handleStopTask}
                className="h-11 px-6 rounded-xl shadow-sm hover:shadow-md transition-all"
              >
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>
            ) : (
              <Button
                onClick={handleRunTask}
                disabled={!taskInput.trim()}
                className="h-11 px-6 rounded-xl bg-black text-white hover:bg-gray-800 shadow-lg hover:shadow-xl transition-all"
              >
                <Play className="w-4 h-4 mr-2" />
                Run
              </Button>
            )}
          </div>
        </div>

        {/* Task List */}
        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto py-6 px-6 space-y-4">
            {tasks.length === 0 ? (
              <Card className="border-gray-200 shadow-sm">
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-lg">No tasks yet</CardTitle>
                  <CardDescription className="text-base">
                    Create a task above to get started with OpenSkynet
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              tasks.map((task) => (
                <Card key={task.id} className="border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base">{task.description}</CardTitle>
                        <CardDescription className="text-sm mt-0.5">
                          Created: {new Date(task.createdAt).toLocaleString()}
                        </CardDescription>
                      </div>
                      <span className={getStatusStyles(task.status)}>
                        {task.status.toUpperCase()}
                      </span>
                    </div>
                  </CardHeader>
                  {task.result && (
                    <CardContent>
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl text-sm overflow-x-auto border border-gray-800">
                        {task.result}
                      </pre>
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
