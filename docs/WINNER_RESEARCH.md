# Focused winner research

I researched specific projects, inspected their documentation and selected source files, and separated award evidence from project claims. I did not run their live integrations or copy their implementation. Research was bounded so it did not displace the SmartSpectra build.

## Jennycruzy: Trueup Witness

**Award evidence:** the organizer's 26 October neatHack announcement lists Trueup second, behind Veritas. I could access an [archive of the organizer account](https://nitter.cf/neatlogs), plus an [independent repost](https://xitter.gq/chiraghonnyal). Direct X access returned 403. This is corroborated organizer-attributed evidence through mirrors, not a direct signed award record. The builder describes a tied score; I use the organizer's placement and do not assert a joint first prize.

[Trueup's repository](https://github.com/Jennycruzy/trueup) targets developers whose agent traces incorrectly report success. Its Python witness compares observable execution with recorded telemetry, with a live failure demo, tracing-library fixes, public before/after evidence, tests and a judge entry point. neatlogs, Entire and cfo.ai serve distinct roles. I inspected the README, known-limits and integration structure; the claimed live results are the project's evidence, not my reproduced results. The upstream [neatlogs fix](https://github.com/neatlogs/neatlogs/pull/207) provides a concrete verification route.

**My assessment:** the strongest mechanism is independently checking the claim against the event. This directly informs Cuelira's accepted-observation payload attached to each automatic transition. The weakness to avoid is inaccessible proof: outside-service links can age, and witness coverage is bounded by integrations. I keep local reports inspectable and explicitly name untested hardware. I found no public judge-by-judge scoring explanation; I do not invent one.

## mrnetwork0001 / NetLayer Labs: Calmr

**Award evidence:** Visko's 8 October Orbis Online Challenge announcement places Calmr first, visible in an [archive of Visko's account](https://teapawt.org/viskoai). [NetLayer's account](https://teapawt.org/NetLayerLabs) connects the project and builder; direct X was inaccessible. This is organizer-attributed mirror evidence. A secondary [company activity record](https://www.seedops.co/companies/visko-platform) corroborates it.

I cloned and inspected [Calmr](https://github.com/NetLayerLabs/Calmr), including its steering engine, reports and limitations. A heart-rate source changes a live Orbis scene through deterministic steering. Its UI explains causality; the report labels source mode. Its README distinguishes genuine generated scenes from a manually controlled heart-rate input in demonstration recordings. It also acknowledges unreliable webcam pulse and untested patient strap use. I did not reproduce clinical or sensor claims. Public Visko praise shows enthusiasm for the concept, not a clinical evaluation.

**My assessment:** sponsor-native output and a complete session/report loop are valuable. Cuelira adopts explicit causality and honest source labeling, with authored dialogue instead of paid video generation. Cuelira must improve on the hardware evidence gap for this particular contest: manual control cannot substitute for a live Presage cue. I make no exposure-therapy claims and import no Calmr code or assets.

## 0xNexuz: ScoutGuard PRO

**Award evidence:** the 4 November Blockscout announcement names ScoutGuard second in its API Buildathon with Craftora, corroborated by the host's announcement ([Blockscout archive](https://xitter.gq/blockscout), [Craftora archive](https://teapawt.net/craftorahq/with_replies)). These are organizer-attributed mirror sources; direct X access remains unavailable. The [official host project page](https://craftora.tech/project/scoutguard/) links the builder to `0xNexuz/scoutguard-pro`. This is stronger than a builder's unsupported prize claim.

I inspected its repository README, policy engine and feedback/evidence notes. The product checks an unsigned payment against Blockscout observations and deterministic limits before an agent signs. Its TypeScript backend, live evidence inspector, replay, exports and mock-agent adapter form a complete investigation workflow. Sponsor feedback publicly emphasizes products with demand and Blockscout at the center, not a private scorecard. Tests and successful provider checks are published project claims, not runs I reproduced.

**My assessment:** explicit live/recorded/simulated modes, bounded provider requests and conservative unavailable-data handling are useful patterns. Its documented limits include partial replay archives and no proof of real-wallet loss prevention. Cuelira likewise must attach the actual causal observation and never upgrade a synthetic or manual result into live proof. I copied no code; this corroborating case reinforces my existing provenance decisions.

## 0xNexuz: Shop Ledger, additional award verification limited

The [builder's post](https://www.xitter.cf/magnuskrypt) claims sixth place, honorable mention and Best Productivity App at Builder.io's Agent-Native hackathon. The [repository](https://github.com/0xNexuz/0xNexuz-shop-ledger) links the same app and identifies the builder as Mag. I did not locate an accessible organizer announcement confirming that category. **Self-reported award, not independently verified.** A profile count or participation listing is not win evidence.

I examined the specific product documentation: a multilingual small-shop bookkeeper connects sales, stock and customer credit. Shared typed server actions serve UI and agent; human-only approvals protect outward reminders and imports. It offers a sample shop, manual forms, reports and public validation instructions. Those test claims were not reproduced by me. My assessment is that the complete sale-to-stock-to-debt workflow is stronger than a chat shell. It motivates Cuelira's complete rehearsal-to-review-to-export loop and manual fallback with provenance. Dependence on hosted auth/model services is an availability limitation; I found no public organizer feedback explaining its selection. I do not present this as a verified winner case.

## Previous DEV winners with direct organizer evidence

The [Storyblok winners announcement](https://dev.to/devteam/congrats-to-the-storyblok-headless-cms-challenge-winners-12i2) directly names **Blok Tales** Overall Winner and **Storyblok MCP Server** Amazing AI Winner. Organizers praise Blok Tales' use of whitelisting, block ordering and references, and the MCP server's management-API coverage. These are actual published selection explanations.

[Blok Tales' submission](https://dev.to/ansellmaximilian/blok-tales-a-visual-novel-made-with-storyblok-1d26) describes a React/Tailwind/Router visual-novel engine, structured scenes, branching choices and editable characters. Screenshots and a demo make the story inspectable. The author flags a nonpublic duplication link and asset-caching issues; a commenter reports broken images. This is a useful warning: I bundle Cuelira's single original scene and typography, so judges do not need a remote content workspace. I did not reproduce the project. Neither organizer statement establishes accessibility or privacy excellence by itself.

## Decisions I applied

- Put the sponsor-dependent mechanism at the center: accepted face metrics cause the response.
- Show what caused each response, including manual provenance and unavailable intervals.
- Complete the smallest useful workflow before adding more scenes.
- Make proof reachable: source paths, local report, reproducible checks and an honest status table.
- Learn from gaps: do not mistake a beautiful replay or a successful fixture for live hardware evidence.

These are my deductions from a small, selected sample. They are not official criteria, universal winning patterns or a guarantee of a prize. I found insufficient evidence to claim that responsible data handling caused these particular awards; it is independently mandatory for the Presage challenge.
