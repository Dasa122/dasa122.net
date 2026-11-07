import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <main className="section rise flex-1">
      <div className="mx-auto grid w-full max-w-[80rem] grid-cols-12 gap-x-6 px-6 md:px-10">
        <h1 className="col-span-12 font-display text-[clamp(4.5rem,17vw,13rem)] leading-[0.82] tracking-[-0.035em] md:col-span-10">
          Dasa122
        </h1>
      </div>
    </main>
  );
}
