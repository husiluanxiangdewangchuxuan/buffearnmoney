import { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { callStock, errorText } from '@/components/stock/stockClient';

function readContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const timer = setTimeout(() => { reader.abort(); reject(new Error('读取文件超时，请将文件保存到本机后重新选择')); }, 30000);
    reader.onload = () => { clearTimeout(timer); resolve(String(reader.result).split(',')[1]); };
    reader.onerror = () => { clearTimeout(timer); reject(new Error('无法读取文件，请先下载到本机，再从“文件”中选择')); };
    reader.onabort = () => { clearTimeout(timer); reject(new Error('文件读取已中断，请重新选择文件')); };
    reader.readAsDataURL(file);
  });
}
function withTimeout(request, message) {
  let timer;
  return Promise.race([request, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), 60000); })]).finally(() => clearTimeout(timer));
}
export default function useImportUpload(onLoaded) {
  const active = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [progress, setProgress] = useState('');
  async function load(file) {
    if (!file || active.current) return;
    setError(''); setProgress('');
    if (!/\.(xlsx|csv)$/i.test(file.name) || file.size > 1048576) { setError('请选择1MB以内的XLSX或UTF-8 CSV文件'); return; }
    if (!file.size) { setError('所选文件为空，请保存表格内容后重新选择'); return; }
    active.current = true; setBusy(true);
    try {
      setProgress(`已选择 ${file.name}，正在读取…`);
      const content = await readContent(file);
      setProgress(`正在检查 ${file.name} 的标题与库存行…`);
      const inspected = await withTimeout(callStock('stockImport', { action: 'inspect', filename: file.name, content }), '表格检查超时，尚未入库，请重新选择文件重试');
      setProgress('表格检查通过，正在私密保存文件…');
      const { file_uri } = await withTimeout(base44.integrations.Core.UploadPrivateFile({ file }), '私密保存超时，尚未入库，请重新选择文件重试');
      if (!file_uri) throw new Error('未取得私密文件保存结果，尚未入库，请重试');
      onLoaded({ content, filename: file.name, file_uri, ...inspected });
    } catch (e) { setError(errorText(e)); }
    finally { active.current = false; setBusy(false); setProgress(''); }
  }
  return { busy, error, progress, load };
}