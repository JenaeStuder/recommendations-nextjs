import type { Question } from "@/lib/questions";

type Props = {
  question: Question;
  selected: string[];
  onToggle: (optionId: string) => void;
};

/**
 * Native checkboxes/radios styled as chips: keyboard, focus and screen-reader
 * behaviour come from the browser instead of being re-implemented.
 */
export function OptionGroup({ question, selected, onToggle }: Props) {
  const multi = question.kind === "multi";
  const atMax = multi && question.max !== undefined && selected.length >= question.max;

  return (
    <div className="flex flex-wrap gap-3">
      {question.options.map((option) => {
        const checked = selected.includes(option.id);
        const disabled = multi && atMax && !checked;
        return (
          <label
            key={option.id}
            className={[
              "group relative cursor-pointer select-none rounded-full border px-5 py-2.5 text-base transition-colors",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
              checked
                ? "border-ink bg-ink text-paper"
                : "border-line bg-surface hover:border-ink",
              disabled ? "cursor-not-allowed opacity-45 hover:border-line" : "",
            ].join(" ")}
          >
            <input
              type={multi ? "checkbox" : "radio"}
              name={question.id}
              value={option.id}
              checked={checked}
              disabled={disabled}
              // Radios never fire change when re-clicked; optional questions need
              // to be clearable, so single-choice toggles on click instead.
              onChange={multi ? () => onToggle(option.id) : () => {}}
              onClick={multi ? undefined : () => onToggle(option.id)}
              className="sr-only"
            />
            <span className="font-medium">{option.label}</span>
            {option.hint && (
              <span className={`block text-sm ${checked ? "text-paper/80" : "text-muted"}`}>
                {option.hint}
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}
