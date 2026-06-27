'use client';

import { useRef, useState } from 'react';
import { downloadExport, markBackupDone, importAllData } from '@/lib/storage';

export default function DataManagementCard() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Data beheer</h2>
      <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-3">
        <p className="text-sm text-gray-500">
          Exporteer je data als backup of importeer een eerder gemaakte backup.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => {
              downloadExport();
              markBackupDone();
              setStatus({ type: 'success', msg: 'Backup gedownload!' });
              setTimeout(() => setStatus(null), 3000);
            }}
            className="flex-1 py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all text-sm"
          >
            Exporteer data
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-3 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all text-sm"
          >
            Importeer data
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (!confirm('Dit overschrijft alle huidige data. Doorgaan?')) {
              e.target.value = '';
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              const result = importAllData(reader.result as string);
              if (result.success) {
                setStatus({ type: 'success', msg: 'Data succesvol geimporteerd! Pagina herlaadt...' });
                setTimeout(() => window.location.reload(), 1500);
              } else {
                setStatus({ type: 'error', msg: result.error || 'Import mislukt' });
              }
            };
            reader.readAsText(file);
            e.target.value = '';
          }}
        />
        {status && (
          <div className={`text-sm p-3 rounded-xl ${
            status.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
          }`}>
            {status.msg}
          </div>
        )}
      </div>
    </section>
  );
}
