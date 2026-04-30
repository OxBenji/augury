interface AgentCardProps {
  name: string;
  spanishName?: string;
  role: string;
  model: string;
  description: string;
}

export function AgentCard({ name, spanishName, role, model, description }: AgentCardProps) {
  return (
    <div className="group border border-smoke/30 rounded-sm p-5 transition-colors hover:border-oxblood/60">
      <h3 className="font-cinzel text-lg text-bone tracking-wide group-hover:underline group-hover:decoration-oxblood group-hover:underline-offset-4">
        {name}
      </h3>
      {spanishName && (
        <p className="text-patina/70 text-xs mt-0.5 italic font-cinzel">{spanishName}</p>
      )}
      <p className="text-ash text-sm mt-1 font-geist">{role}</p>
      <p className="text-ash/60 text-xs mt-1 font-mono">{model}</p>
      <p className="text-bone/70 text-sm mt-3 leading-relaxed">{description}</p>
    </div>
  );
}
