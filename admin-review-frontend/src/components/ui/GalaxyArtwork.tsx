import { GameScene, type GameName } from '@/components/games/GameVisuals';
export type GalaxyGame = GameName;
export default function GalaxyArtwork({ game, className = '' }: { game: GalaxyGame; className?: string }) {
  return <div aria-hidden="true" className={`gxArtwork gxGameScene ${className}`}><GameScene game={game}/></div>;
}
