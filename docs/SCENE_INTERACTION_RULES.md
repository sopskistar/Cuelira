# Interaction rules

I keep scene logic deterministic. Only `Rehearsal.observe` can create an `accepted` event. Manual continuation calls a different method and creates `manual`.

## Provisional configuration

| Guard                                 | Current value                                  |
| ------------------------------------- | ---------------------------------------------- |
| Cue arming after beat entry           | 8 seconds, allowing line reading               |
| Confidence                            | At least 65% for the highest-ranked expression |
| SDK stability                         | `stable === true`                              |
| Validation                            | `kOk`, with face available                     |
| Sustained matching samples            | At least 700 ms                                |
| Maximum adjacent sample gap           | 550 ms; a gap resets the hold                  |
| Maximum sample / receipt age          | 1200 ms                                        |
| Future timestamp allowance            | 200 ms                                         |
| Cooldown between accepted transitions | At least 1500 ms                               |
| Cue timeout notice                    | 35 seconds, no automatic advancement           |

These are explicitly **not calibrated hardware thresholds**. I must test them on real faces and lighting before claiming reliable recognition.

Samples must be newer than the last processed sample and current beat entry. A wrong category, malformed data, unavailable face, warning, unstable/weak score, stale event or long gap breaks the hold. A transition advances one beat and resets arming. The same event cannot fire twice. Pausing or errors stop recognition. Resume/recovery creates a new entry and discards the old hold.

For the final neutral cue, the current beat must first see a valid stable non-neutral departure sustained for 300 ms. Earlier neutral or angry observations from other beats do not count. The neutral return then follows the usual arming and hold guards. This applies after manual advancement too.

When metrics disappear, the engine records an unavailable interval without inventing a measurement. Sampled observation events are retained at up to four per second; accepted observations retain their full normalized evidence independently. Review is a causal event record, not a frame-by-frame raw telemetry archive. It is not independent hardware attestation.
