'use client';
import { useState, useEffect } from 'react';
import { saveAppConfig, getAppConfig } from '@/app/actions';

export function WompiSettings() {
  const [config, setConfig] = useState({ publicKey: '', privateKey: '', environment: 'sandbox' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAppConfig('wompi_config').then(data => {
      if (data) setConfig(data);
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await saveAppConfig('wompi_config', config);
      alert('Configuración guardada correctamente');
    } catch (error) {
      alert('Error al guardar: ' + error);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div>Cargando...</div>;

  return (
    <div className="p-6 bg-white rounded-lg border border-gray-200 shadow-sm max-w-lg">
      <h2 className="text-xl font-bold mb-4">Configuración de Pasarela Wompi</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Environment</label>
          <select 
            value={config.environment}
            className="block w-full mt-1 p-2 border rounded"
            onChange={e => setConfig({...config, environment: e.target.value})}
          >
            <option value="sandbox">Sandbox (Pruebas)</option>
            <option value="prod">Producción</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Public Key</label>
          <input 
            value={config.publicKey}
            className="block w-full mt-1 p-2 border rounded"
            onChange={e => setConfig({...config, publicKey: e.target.value})}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Private Key</label>
          <input 
            type="password"
            value={config.privateKey}
            className="block w-full mt-1 p-2 border rounded"
            onChange={e => setConfig({...config, privateKey: e.target.value})}
          />
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  );
}
