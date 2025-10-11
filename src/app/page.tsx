import prisma from "./lib/db";


export default async function Home() {
  const projects = await prisma.project.findMany();
  return (
    <main className="p-10">
      <h1 className="text-2xl font-bold">Projects</h1>
      <pre>
        {JSON.stringify(projects, null, 2)}
      </pre>
    </main>
  );
}
