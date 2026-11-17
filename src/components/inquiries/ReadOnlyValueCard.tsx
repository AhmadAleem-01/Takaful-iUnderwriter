export function ReadOnlyValueCard({ value, multiline = false, as: Tag = 'div' }: { value?: string | null; multiline?: boolean; as?: 'div' | 'dd' }) {
  return (
    <Tag className={`min-w-0 rounded-xl border border-border bg-surface px-4 py-3 text-[12px] font-normal leading-6 text-foreground [overflow-wrap:anywhere] ${multiline ? 'whitespace-pre-wrap' : 'break-words'}`}>
      {value?.trim() ? value : <span className="text-muted-foreground">Not provided</span>}
    </Tag>
  )
}
