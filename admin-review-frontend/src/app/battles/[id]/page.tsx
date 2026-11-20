import React from "react";
import BattleDetailPage from "@/components/battles/BattleDetailPage";
import { getBattleById } from "@/lib/api/battles";

export default async function BattlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const battle = await getBattleById(id);

  if (!battle) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white text-center">
          <p className="text-lg">Battle not found</p>
          <p className="text-sm text-[#6c6c71] mt-2">The battle you're looking for doesn't exist</p>
        </div>
      </div>
    );
  }

  return <BattleDetailPage battle={battle} />;
}
