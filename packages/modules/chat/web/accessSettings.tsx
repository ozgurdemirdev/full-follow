import { useState } from "react";
import { Dialog } from "@kit/components/Dialog";
import { ControlSkeleton } from "@kit/components/settings/Fields";
import { SetAddForm, SetChip, SetListEditor, Switch } from "@kit/components/settings/Parts";
import { putSettings, useSettings, type SettingRow } from "@kit/lib/settings";
import { m as kit } from "@kit/messages";
import { m } from "./messages";

const t = m.access;
const words = (list: string) => list.split("|");

/** Full authority: turning it on asks first in the app's dialog, with the warning; turning it off never asks */
function FullAccess() {
  const s = useSettings();
  const [asking, setAsking] = useState(false);
  if (!s.data) return s.loading ? <ControlSkeleton /> : null;
  const set = (on: boolean) => void putSettings({ chat_full_access: on }, on ? t.fullOn : t.fullOff).catch(() => {});
  return (
    <>
      <Switch label={t.fullTitle} on={s.data.chat_full_access} onChange={(on) => (on ? setAsking(true) : set(false))} />
      {asking && (
        <Dialog label={t.dialogTitle} onCancel={() => setAsking(false)}>
          <h2 className="dlg-title">{t.dialogTitle}</h2>
          <p className="dlg-text">{t.dialogBody}</p>
          <div className="dlg-foot">
            <button type="button" className="dlg-btn" onClick={() => setAsking(false)}>{kit.cancel}</button>
            <button type="button" className="dlg-btn is-danger" onClick={() => (setAsking(false), set(true))}>{t.dialogConfirm}</button>
          </div>
        </Dialog>
      )}
    </>
  );
}

/** A plain on/off access switch */
function AccessSwitch({ field, label }: { field: "chat_web_fetch" | "chat_local_files"; label: string }) {
  const s = useSettings();
  if (!s.data) return s.loading ? <ControlSkeleton /> : null;
  return <Switch label={label} on={s.data[field]} onChange={(on) => void putSettings({ [field]: on }).catch(() => {})} />;
}

/** The folders the chat's file tools may reach: the server checks each added path (absolute, existing, not the data folder) */
function Folders() {
  const s = useSettings();
  if (!s.data) return s.loading ? <ControlSkeleton /> : null;
  const folders = s.data.chat_local_folders;
  return (
    <SetListEditor add={<SetAddForm placeholder={t.folderPlaceholder} label={t.folderInput} onAdd={(dir) => putSettings({ chat_local_folders: [...folders, dir] }, t.folderAdded)} />}>
      {folders.length ? folders.map((dir) => (
        <SetChip key={dir} title={dir} removeLabel={t.folderRemove(dir)} dot={<i className="set-dot set-dot-neutral" />}
          remove={() => void putSettings({ chat_local_folders: folders.filter((f) => f !== dir) }, t.folderRemoved).catch(() => {})}>
          <span className="mono">{dir}</span>
        </SetChip>
      )) : <span className="set-empty">{t.foldersEmpty}</span>}
    </SetListEditor>
  );
}

/** The access rows of the "Claude" category: full authority, page reading, local files and their folders */
export const accessRows = (): SettingRow[] => [
  { id: "chat-full-access", name: t.fullTitle, hint: t.fullHint, keywords: words(t.fullKeywords), control: <FullAccess /> },
  { id: "chat-web-fetch", name: t.fetchTitle, hint: t.fetchHint, keywords: words(t.fetchKeywords), control: <AccessSwitch field="chat_web_fetch" label={t.fetchTitle} /> },
  { id: "chat-local-files", name: t.filesTitle, hint: t.filesHint, keywords: words(t.filesKeywords), control: <AccessSwitch field="chat_local_files" label={t.filesTitle} /> },
  { id: "chat-local-folders", name: t.foldersLabel, keywords: words(t.filesKeywords), wide: true, control: <Folders /> },
];
