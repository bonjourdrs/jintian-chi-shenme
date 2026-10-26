import { useState } from "react";
import {
  corruptRecoveryExists,
  exportCorruptRecovery,
} from "../lib/recovery.ts";
import { useApp } from "../state/store.tsx";
export function RecoveryNotice() {
  const [visible, setVisible] = useState(() => corruptRecoveryExists()),
    { recoverCorrupt, toast } = useApp();
  if (!visible) return null;
  return (
    <aside className="recovery-notice" role="alert">
      <strong>检测到一份格式异常的旧数据，原文件已隔离保留。</strong>
      <p>可以先导出原文件，再尝试合并其中有效的菜和账本记录。</p>
      <div className="row-btns wrap">
        <button
          className="btn-secondary"
          onClick={() => {
            try {
              exportCorruptRecovery();
            } catch {
              toast("导出失败，请检查浏览器权限");
            }
          }}
        >
          导出隔离原文
        </button>
        <button
          className="btn-primary"
          onClick={() => {
            if (recoverCorrupt()) setVisible(false);
          }}
        >
          恢复有效记录
        </button>
        <button className="btn-ghost" onClick={() => setVisible(false)}>
          稍后处理
        </button>
      </div>
    </aside>
  );
}
