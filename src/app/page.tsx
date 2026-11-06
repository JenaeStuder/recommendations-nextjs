import { QuestionFlow } from "@/components/question-flow/question-flow";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 sm:py-20">
      <h1 className="mb-10 font-serif text-lg text-muted">Find your next book</h1>
      <QuestionFlow />
    </main>
  );
}
