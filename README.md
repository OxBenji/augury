# Augury

> read the swarm.

A swarm of nine specialist AI agents reading onchain markets in
adversarial consensus. Built on elizaOS. Open source.

## The Flock

| Agent      | Role                       | Model         |
|------------|----------------------------|---------------|
| Lituus     | Sky-quadrant filter        | Deterministic |
| Haruspex   | Reader of internals        | Haiku         |
| Auspex     | Watcher of voices          | Haiku         |
| Chronos    | Keeper of flow             | Haiku         |
| Fas        | The divine yes             | Sonnet        |
| Nefas      | The divine no              | Sonnet        |
| Sibyl      | Keeper of the record       | Haiku         |
| Speculum   | The backward mirror        | Haiku         |
| Vates      | The lightning-reader       | Deterministic |

A reading is delivered only when the divine yes (Fas) and the divine no
(Nefas) agree.

## Status

Augury is in active development. Architecture is wired and the Speculum
replay engine runs against historical Solana memecoin decisions.
Real-LLM smoke tests are pending.

Live: https://landing-wine-iota.vercel.app

## Stack

- TypeScript / Bun
- elizaOS character files
- Anthropic Claude (Haiku 4.5 workers, Sonnet 4.5 coordinators)
- Solana via Helius webhooks
- Provenance via xProof on MultiversX (planned)

## Local development

```
npm install
cp .env.example .env
npm run build
bun run src/cli/speculum.ts --limit=200
```

## Author

Built by [@litboy11](https://x.com/litboy11) /
[@OxBenji](https://github.com/OxBenji). Built in public.

## License

MIT.
