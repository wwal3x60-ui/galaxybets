"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PackDrawingPage from "@/components/packs/PackDrawingPage";
import PackDetailSkeleton from "@/components/packs/PackDetailSkeleton";
import { getPackDetails, type PackDetails } from "@/lib/api/packs";

export default function PackDrawing() {
  const { id } = useParams<{ id: string }>();
  const [loaded, setLoaded] = useState<{
    id: string;
    pack: PackDetails;
  } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setLoaded(null);
    setError("");

    async function loadPack() {
      try {
        const response = await getPackDetails(id);

        if (!response?.data) {
          throw new Error("The case could not be loaded.");
        }

        if (!cancelled) {
          setLoaded({ id, pack: response.data });
        }
      } catch {
        if (!cancelled) {
          setError(
            "Could not load this case. Check that the backend is running and try again."
          );
        }
      }
    }

    void loadPack();

    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  if (error) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold text-white">
          Unable to load case
        </h1>

        <p className="mt-4 text-sm text-white/60">{error}</p>

        <button
          type="button"
          onClick={() => {
            setError("");
            setAttempt((value) => value + 1);
          }}
          className="mt-6 rounded-lg mcPrimary px-5 py-3 text-white hover:bg-purple-500"
        >
          Try again
        </button>
      </main>
    );
  }

  if (!loaded || loaded.id !== id) {
    return <PackDetailSkeleton />;
  }

  return (
    <PackDrawingPage
      key={id}
      initialPack={loaded.pack}
      packId={id}
    />
  );
}