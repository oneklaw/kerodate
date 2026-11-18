import { useEffect, useState } from 'react';
import { Check, Copy, Download, FileCode2 } from 'lucide-react';
import { BlueprintFile } from '../types/app';

export function BlueprintDocsView() {
  const [files, setFiles] = useState<BlueprintFile[]>([]);
  const [category, setCategory] = useState<string>('all');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/blueprints')
      .then((r) => r.json())
      .then((data: { files: BlueprintFile[] }) => {
        if (!active) return;
        setFiles(data.files || []);
        if (data.files?.length > 0) {
          setSelectedPath(data.files[0].path);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const categories = ['all', ...Array.from(new Set(files.map((f) => f.category)))];
  const visibleFiles =
    category === 'all' ? files : files.filter((f) => f.category === category);

  const selectedFile =
    visibleFiles.find((f) => f.path === selectedPath) ?? visibleFiles[0] ?? null;

  const handleCopy = async () => {
    if (!selectedFile) return;
    await navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    if (!selectedFile) return;
    const blob = new Blob([selectedFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.path.split('/').pop() || 'blueprint.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-label="Laravel PHP, React Native and Deployment Blueprint" className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Production Source Tree &amp; Runbooks
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mt-1">
            Laravel PHP, React Native &amp; Docs
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1.5">
            Inspect, copy, or download the full Laravel migrations, Eloquent models, Blade + Tailwind top-up view, Flutterwave/MTN MoMo webhook handlers, React Native screens, and deployment guide.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto shrink-0">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap min-h-[36px] ${
                category === cat
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {cat === 'all' ? 'All Files' : cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-sm text-zinc-500 dark:text-zinc-400">
          Loading Laravel &amp; React Native source files...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <aside className="lg:col-span-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {visibleFiles.length} Source Files
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[560px] overflow-y-auto">
              {visibleFiles.map((file) => {
                const active = selectedFile?.path === file.path;
                return (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => setSelectedPath(file.path)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-2.5 transition-colors ${
                      active
                        ? 'bg-rose-50/60 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <FileCode2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-xs font-mono truncate">{file.path}</p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {file.category}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="lg:col-span-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
            {selectedFile ? (
              <>
                <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                  <span className="text-xs font-mono text-zinc-700 dark:text-zinc-300 truncate">
                    {selectedFile.path}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="min-h-[36px] px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-1.5"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                          Copy
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="min-h-[36px] px-3 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      Download
                    </button>
                  </div>
                </div>
                <pre className="p-5 text-xs font-mono leading-relaxed overflow-auto max-h-[540px] bg-zinc-950 text-zinc-100">
                  <code>{selectedFile.content}</code>
                </pre>
              </>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
