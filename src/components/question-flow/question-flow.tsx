"use client";

import { useEffect, useReducer, useRef } from "react";
import { STEPS, getQuestion, type Question } from "@/lib/questions";
import { hasTaste } from "@/lib/taste";
import { INITIAL_STATE, TASTE_STEP, reducer } from "./flow-state";
import { OptionGroup } from "./option-group";
import { Results } from "./results";
import { TasteStep } from "./taste-step";

/** Step 0 is "a book or author you love"; steps 1..N are STEPS (one or more questions each); then results. */
const TOTAL_STEPS = STEPS.length + 1;
const RESULTS_STEP = TOTAL_STEPS;

const BUTTON_FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/**
 * One question: a fieldset so assistive tech announces the group. The step's main question gets
 * the page-level heading (and receives focus on arrival); extra questions on the same screen get
 * a smaller sub-heading.
 */
function QuestionBlock({
  question,
  selected,
  primary,
  onToggle,
}: {
  question: Question;
  selected: string[];
  primary: boolean;
  onToggle: (option: string) => void;
}) {
  const Heading = primary ? "h2" : "h3";
  return (
    <fieldset aria-describedby={`${question.id}-desc`}>
      <legend className="mb-1">
        <Heading
          {...(primary ? { "data-step-heading": true, tabIndex: -1 } : {})}
          className={`font-serif leading-tight outline-none ${primary ? "text-3xl" : "text-2xl"}`}
        >
          {question.title}
        </Heading>
      </legend>
      <p className="mb-6 text-muted" id={`${question.id}-desc`}>
        {question.description}
        {question.kind === "multi" && question.max && (
          <span aria-live="polite">
            {" "}
            ({selected.length} of {question.max} chosen)
          </span>
        )}
      </p>
      <OptionGroup question={question} selected={selected} onToggle={onToggle} />
    </fieldset>
  );
}

export function QuestionFlow() {
  const [{ step, answers, taste }, dispatch] = useReducer(reducer, INITIAL_STATE);
  const firstRender = useRef(true);

  // Move focus to the new step's heading so keyboard and screen-reader users
  // land on the new content. Skipped on first render so we don't steal focus.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.querySelector<HTMLElement>("[data-step-heading]")?.focus();
  }, [step]);

  if (step === RESULTS_STEP) {
    return (
      <Results
        answers={answers}
        taste={taste}
        onNewSearch={() => dispatch({ type: "reset" })}
      />
    );
  }

  const isTaste = step === TASTE_STEP;
  const stepDef = isTaste ? undefined : STEPS[step - 1];
  const questions = stepDef?.questions.map(getQuestion) ?? [];

  // Naming a book or author is enough to get recommendations, so genres stop being mandatory.
  const missingRequired = questions.some(
    (q) => q.required && !hasTaste(taste) && answers[q.id].length === 0,
  );
  const canContinue = !missingRequired;
  const isLast = step === TOTAL_STEPS - 1;
  const answered = isTaste ? hasTaste(taste) : questions.some((q) => answers[q.id].length > 0);
  const nextLabel = isLast ? "Show my books" : !answered && canContinue ? "Skip" : "Next";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canContinue) dispatch({ type: "go", step: step + 1 });
      }}
    >
      <div className="mb-8">
        <p className="text-sm text-muted">
          Step {step + 1} of {TOTAL_STEPS}
        </p>
        <div
          role="progressbar"
          aria-label="Progress"
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
          aria-valuenow={step + 1}
          className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line"
        >
          <div
            className="h-full bg-accent transition-[width] duration-300"
            style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      {isTaste ? (
        <div role="group" aria-labelledby="taste-heading">
          <h2
            id="taste-heading"
            data-step-heading
            tabIndex={-1}
            className="mb-1 font-serif text-3xl leading-tight outline-none"
          >
            Is there a book or author you love?
          </h2>
          <p className="mb-8 text-muted">
            Tell us one, both, or neither. We&apos;ll look for books like them.
          </p>
          <TasteStep
            taste={taste}
            onBook={(book) => dispatch({ type: "book", book })}
            onAuthor={(author) => dispatch({ type: "author", author })}
          />
        </div>
      ) : (
        <div className="space-y-10">
          {stepDef?.heading && (
            <div>
              <h2
                data-step-heading
                tabIndex={-1}
                className="mb-1 font-serif text-3xl leading-tight outline-none"
              >
                {stepDef.heading.title}
              </h2>
              <p className="text-muted">{stepDef.heading.description}</p>
            </div>
          )}
          {questions.map((question, i) => (
            <QuestionBlock
              key={question.id}
              question={question}
              selected={answers[question.id]}
              // Without a step heading, the first question is the screen's main heading.
              primary={!stepDef?.heading && i === 0}
              onToggle={(option) => dispatch({ type: "toggle", question: question.id, option })}
            />
          ))}
        </div>
      )}

      <div className="mt-10 flex items-center gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={() => dispatch({ type: "go", step: step - 1 })}
            className={`rounded-full border border-ink px-5 py-2.5 ${BUTTON_FOCUS}`}
          >
            Back
          </button>
        )}
        <button
          type="submit"
          disabled={!canContinue}
          className={`rounded-full bg-ink px-6 py-2.5 font-medium text-paper disabled:cursor-not-allowed disabled:opacity-45 ${BUTTON_FOCUS}`}
        >
          {nextLabel}
        </button>
        {!canContinue && (
          <span className="text-sm text-muted">Choose at least one to continue.</span>
        )}
      </div>
    </form>
  );
}
