/** Reviewer's workflow builder: add / rename / remove / reorder ordered steps. */
export function WorkflowStepsEditor({
  steps,
  onChange,
}: {
  steps: string[];
  onChange: (steps: string[]) => void;
}) {
  const update = (i: number, value: string) => onChange(steps.map((s, idx) => (idx === i ? value : s)));
  const remove = (i: number) => onChange(steps.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => onChange([...steps, `Step ${steps.length + 1}`]);

  return (
    <div className="steps-editor">
      <ol className="steps-list">
        {steps.map((step, i) => (
          <li key={i} className="step-row">
            <span className="step-index">{i + 1}</span>
            <input value={step} onChange={(e) => update(i, e.target.value)} aria-label={`Step ${i + 1} name`} />
            <div className="step-controls">
              <button type="button" className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} title="Move up">
                ↑
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => move(i, 1)}
                disabled={i === steps.length - 1}
                title="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                className="icon-btn danger-text"
                onClick={() => remove(i)}
                disabled={steps.length <= 1}
                title="Remove"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" className="btn-ghost" onClick={add}>
        + Add step
      </button>
    </div>
  );
}
