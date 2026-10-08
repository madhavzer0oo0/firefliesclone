import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">Meeting workspace</p>
      <h1 className="text-4xl font-semibold tracking-tight">Application foundation</h1>
      <p className="max-w-xl text-base leading-7 text-foreground/70">
        The meeting API, sample conversations, and typed client are ready for the next phase.
        The library and transcript interface will be built here.
      </p>
      <div><Button asChild><a href="http://localhost:8000/docs">Explore the local API</a></Button></div>
    </main>
  );
}
