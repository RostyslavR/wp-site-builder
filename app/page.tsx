"use client";

import { useState } from "react";
import { Maximize2, Minimize2, Moon, Sun } from "lucide-react";
import { useLocalSettings } from "@/lib/use-local-settings";
import { useTheme } from "@/lib/use-theme";
import { useFullWidth } from "@/lib/use-full-width";
import { usePlanProgress } from "@/lib/use-plan-progress";
import { Button } from "@/components/ui/button";
import { SettingsForm } from "@/components/settings-form";
import { ChatPanel } from "@/components/chat-panel";
import { InfoDialog } from "@/components/info-dialog";
import { AiSettingsDialog } from "@/components/ai-settings-dialog";
import { MigrationGuideDialog } from "@/components/migration-guide-dialog";
import { cn } from "@/lib/utils";

export default function Home() {
  const { settings, save, loaded } = useLocalSettings();
  const { theme, toggleTheme } = useTheme();
  const { fullWidth, toggleFullWidth, loaded: fullWidthLoaded } = useFullWidth();
  const plan = usePlanProgress();
  const [optionsSlot, setOptionsSlot] = useState<HTMLDivElement | null>(null);

  if (!loaded || !fullWidthLoaded) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-1 flex-col gap-6 p-6 mx-auto w-full",
        fullWidth ? "max-w-none" : "max-w-6xl"
      )}
    >
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Site Dashboard</h1>
        <div className="flex items-center gap-2">
          <AiSettingsDialog settings={settings} onSave={save} />
          <InfoDialog />
          <MigrationGuideDialog />
          <Button
            variant="outline"
            size="icon"
            onClick={toggleFullWidth}
            aria-label={fullWidth ? "Exit full width" : "Full width"}
          >
            {fullWidth ? <Minimize2 /> : <Maximize2 />}
          </Button>
          <Button variant="outline" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <div className="lg:col-span-1 flex flex-col gap-6">
          <SettingsForm settings={settings} onSave={save} />
          <div ref={setOptionsSlot} className="flex flex-wrap gap-4" />
        </div>
        <div className="lg:col-span-3">
          <ChatPanel
            settings={settings}
            elapsedMs={plan.elapsedMs}
            optionsSlot={optionsSlot}
            onTurnStart={plan.onTurnStart}
            onTurnComplete={plan.onTurnComplete}
            onPlanReset={plan.reset}
          />
        </div>
      </div>
    </div>
  );
}
