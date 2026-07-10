import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/tips")({
  component: TipsPage,
});

function TipsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">Tips och råd</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Här kan du hitta tips och råd för dina studier.
        </p>
      </div>

      <Tabs defaultValue="tab1" className="space-y-6">
        <TabsList className="bg-surface-2/60">
          <TabsTrigger value="tab1">Flik 1</TabsTrigger>
          <TabsTrigger value="tab2">Flik 2</TabsTrigger>
          <TabsTrigger value="tab3">Flik 3</TabsTrigger>
        </TabsList>

        <TabsContent value="tab1" className="space-y-6">
          <div className="rounded-2xl border border-dashed border-border/60 bg-surface/40 p-12 text-center text-sm text-muted-foreground">
            Innehåll för flik 1
          </div>
        </TabsContent>

        <TabsContent value="tab2" className="space-y-6">
          <div className="rounded-2xl border border-dashed border-border/60 bg-surface/40 p-12 text-center text-sm text-muted-foreground">
            Innehåll för flik 2
          </div>
        </TabsContent>

        <TabsContent value="tab3" className="space-y-6">
          <div className="rounded-2xl border border-dashed border-border/60 bg-surface/40 p-12 text-center text-sm text-muted-foreground">
            Innehåll för flik 3
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
