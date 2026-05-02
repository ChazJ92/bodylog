import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="card-surface card-accent-top max-w-md space-y-3 px-8 py-10 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-dark">
          Lost
        </p>
        <h1 className="text-5xl font-semibold tracking-tight text-foreground">
          404
        </h1>
        <p className="text-sm text-muted-foreground">
          That page isn't here. Let's get you back to safe ground.
        </p>
        <div className="pt-2">
          <a href="/" className="btn-primary">
            Return home
          </a>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
