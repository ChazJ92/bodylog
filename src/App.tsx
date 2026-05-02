import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ensureAppReady } from "@/services/bootstrapService";
import AppLayout from "@/components/AppLayout";
import Home from "./pages/Home";
import CheckIn from "./pages/CheckIn";
import Measurements from "./pages/Measurements";
import Analysis from "./pages/Analysis";
import Photos from "./pages/Photos";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound.tsx";

const App = () => {
  const [ready, setReady] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  useEffect(() => {
    ensureAppReady()
      .then(() => setReady(true))
      .catch((e) => setSeedError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (seedError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <div className="max-w-md space-y-2">
          <h1 className="text-xl font-semibold">Storage unavailable</h1>
          <p className="text-sm text-muted-foreground">{seedError}</p>
          <p className="text-xs text-muted-foreground">
            This app needs IndexedDB. Try a different browser or disable private mode.
          </p>
        </div>
      </div>
    );
  }
  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center bg-background" aria-label="Loading" />;
  }

  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/checkin" element={<CheckIn />} />
            <Route path="/checkin/:id" element={<CheckIn />} />
            <Route path="/measurements" element={<Measurements />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/photos" element={<Photos />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  );
};

export default App;
