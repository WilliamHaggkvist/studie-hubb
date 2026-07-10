import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatHoursCompact } from "@/lib/timer-store";
import { cn } from "@/lib/utils";

type Bead = {
  id: number;
  left: string;
  bottom: string;
  color: string;
  isNew: boolean;
};

export function RewardJar({
  isJarFull,
  beads,
  weekCompletedSeconds,
  totalWeeklyGoalSeconds,
  weekDoneCount,
  weekTasksCount,
}: {
  isJarFull: boolean;
  beads: Bead[];
  weekCompletedSeconds: number;
  totalWeeklyGoalSeconds: number;
  weekDoneCount: number;
  weekTasksCount: number;
}) {
  return (
    <Card className="glass border-white/5 shadow-lg flex flex-col h-full min-h-[350px]">
      <style>{`
        @keyframes drop-bead {
          0% {
            transform: translateY(-240px);
            opacity: 0;
          }
          65% {
            transform: translateY(0);
            opacity: 1;
          }
          82% {
            transform: translateY(-12px);
          }
          100% {
            transform: translateY(0);
          }
        }
        .animate-drop-bead {
          animation: drop-bead 0.7s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-base flex items-center gap-2">
          <span className="text-lg">🫙</span> Belöningsburken
        </CardTitle>
        <p className="text-[11px] text-muted-foreground leading-normal">
          Fyll burken genom att studera och bocka av veckans uppgifter!
        </p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col items-center justify-between pb-6 pt-2">
        {/* The Jar Container */}
        <div className="relative w-44 h-56 flex flex-col items-center">
          {/* Lid / Cork */}
          <div className="w-16 h-4 bg-amber-800/80 rounded-t-md border-b border-amber-950/40 shadow-md shrink-0 z-10" />
          <div className="w-20 h-2 bg-amber-900/60 rounded-sm shrink-0 z-10" />

          {/* Jar Body */}
          <div className="relative w-full flex-1 rounded-b-[40px] rounded-t-[16px] border-2 border-white/10 bg-white/5 shadow-[inset_0_4px_12px_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xs overflow-hidden flex items-end justify-center">
            {/* Glass reflections */}
            <div className="absolute inset-y-2 left-2 w-1.5 bg-white/10 rounded-full pointer-events-none" />
            <div className="absolute inset-y-2 right-2 w-1.5 bg-white/5 rounded-full pointer-events-none" />
            <div className="absolute top-2 inset-x-4 h-1.5 bg-white/10 rounded-full opacity-50 pointer-events-none" />

            {/* Golden glow when jar is full */}
            {isJarFull && (
              <div className="absolute inset-0 bg-yellow-500/10 animate-pulse pointer-events-none z-0" />
            )}

            {/* Beads / Coins */}
            {beads.map((bead) => (
              <div
                key={bead.id}
                className={cn(
                  "absolute rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,0.2),0_1.5px_3px_rgba(0,0,0,0.2)] z-5",
                  bead.color,
                  bead.isNew && "animate-drop-bead",
                  isJarFull &&
                    "bg-gradient-to-r from-yellow-300 to-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.6)]", // Turn all gold when full!
                )}
                style={{
                  left: bead.left,
                  bottom: bead.bottom,
                  width: "16px",
                  height: "16px",
                }}
              />
            ))}

            {/* Success celebration text inside the jar */}
            {isJarFull && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs z-10 animate-fade-in p-4 text-center">
                <span className="text-3xl animate-bounce">🏆</span>
                <span className="text-xs font-bold text-yellow-400 tracking-wider uppercase mt-1">
                  Burken är full!
                </span>
                <span className="text-[10px] text-white/90 mt-0.5 font-medium leading-normal">
                  Målet uppnått! ✨
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Status explanation */}
        <div className="w-full text-center space-y-1 mt-4">
          <div className="text-[11px] font-semibold text-white">
            Framsteg: {beads.length} {beads.length === 1 ? "kula" : "kulor"} i burken
          </div>
          <p className="text-[10px] text-muted-foreground leading-normal">
            Studietid: {formatHoursCompact(weekCompletedSeconds)} /{" "}
            {formatHoursCompact(totalWeeklyGoalSeconds)} <br />
            Uppgifter med deadline: {weekDoneCount} av {weekTasksCount} klara
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
