# LAST LIGHT — Fikir ve Karar Defteri

*Konuşulan her şeyin durduğu yer. Sohbet penceresi doluyor ve atılıyor; burası
kalıyor. Yeni bir pencerede işe devam edecek olan önce bunu okusun.*

Uzun araştırmalar kendi dosyalarında:

- [`enemy-ai-plan.md`](enemy-ai-plan.md) — Hades'in düşman AI'ı, kod okumasıyla, ve 5 fazlık uyarlama planı
- [`zombie-roster-research.md`](zombie-roster-research.md) — 8 zombi oyununun kadro sayıları ve tekrar eden 7 rol
- [`design-presentation.md`](design-presentation.md) — oyunun tamamının tasarım dökümü
- [`sound-plan.md`](sound-plan.md) — ses hattı ve fazları
- [`../bug.md`](../bug.md) — bulunan her bug, düzeltilmiş olsun olmasın

---

## YAPILDI

| # | İş | Commit | Not |
|---|---|---|---|
| 1 | **Reload sistemi** — şarjör, R ile dolum, otomatik dolum, HUD sayacı + bar, 3 ses, Mae'ye Speedloader sinyali. Shove R'den **F**'ye taşındı | `75e7a45` | DPS'lere dokunulmadı; değişen, her silahın DPS'i **ne kadar süre** taşıdığı |
| 2 | **Zombi sıra sistemi** — aynı anda `3 + sektör×0.7` (tavan 9) saldırıyor, gerisi 7.5–13 m halkada dolanıyor. Sıra 6.5 sn, dinlenme 3.5 sn | `75e7a45` | Ölçüm: 25 sn'de 18 gövdeden 9'u temasa geldi |
| 3 | **Yay çizerek yaklaşma** — düz hat yerine omuzdan, 3 metrede kapanan bir açıyla | `75e7a45` | Düzlük: shambler 0.87, sprinter 0.98 (1.0 = cetvel) |
| 4 | **Hayvan tasma bug'ları** — Bristle 17 m'ye hücum ediyordu, Mouser 4 m'lik kontrolde 5.5 m'yi görüyordu | `a02ea09` | bug.md 15–16 |
| 5 | **Hayvanlar saldırana öncelik veriyor** — `engaged` cesede 5 m avans | `4039e99` | Rook'un ısırıkları %28 → %92 doğru hedefe; bedeli: kondisyon %60 → %23 |
| 6 | **Çığlıkçı** — altıncı tip. 15 m'de durur, 1.2 sn kurulur, çığlıkla ön safı 4'ten 10'a çıkarır (5 sn). Artı **gürültü sistemi**: silah sesi sayaca yazılıyor, 120'de plan dışı bir Çığlıkçı geliyor | `1922dab` | Harvester saniyede 0.3 gürültü üretiyor → hiç çağırmıyor. Kartındaki söz ilk kez doğru |

| 7 | **Kapan (Clinger)** — yedinci tip. 0.35 sn hamle, tutarsa 1.5 sn hareket kilidi. Yuvarlanarak önleniyor, **F** ile kırılıyor, **hayvan** üstünden alıyor. Oyuncuya `drain()` ve `isHeld`, hayvana `penRescues` sayacı + Eli'nin yeni kehaneti geldi | *(aşağıda)* | Ateş etmek serbest kalıyor — silahı da alan tutuş karar değil, ara sahne olurdu |

---

## SIRADA

### Çığlıkçının dengesi *(oynayıp bakılacak)*
Yapıldı, ama masa başında ayarlandı. İzlenecek sayılar, hepsi `Engine.ts`
tepesinde: `SCREAM_LANES` (6), `SCREAM_LANE_DURATION` (5 sn),
`NOISE_THRESHOLD` (120), `NOISE_DECAY` (2.5). `Enemy.ts` tarafında
`SCREAM_STANDOFF` (15 m), `SCREAM_WINDUP` (1.2 sn), `SCREAM_COOLDOWN` (9 sn).

Bilinen pürüzler:
- **Boomstick menzili 16 m, Çığlıkçı 15 m'de duruyor.** Çifteyle oynayan
  oyuncu onu ancak menzilinin ucundan vurabiliyor. Şimdilik bilerek bırakıldı
  (çifte zaten az gürültü üretiyor, yani ona daha az Çığlıkçı geliyor) ama
  oynarken sinir bozucuysa `SCREAM_STANDOFF` 13'e inebilir.
- **Minimap'te ayırt edilmiyor.** Bütün zombiler aynı blip. Çığlıkçı uzakta
  durduğu için asıl bulunması gereken şey o — minimap'e ayrı renk iyi olur.
- Ekranda ayırt etme: sarkık çene (geometri) + kurulurken `hot` yanıp sönmesi.
  Kalabalıkta yeterli mi, oynayınca belli olacak.

### Kapanın dengesi *(oynayıp bakılacak)*
Sayılar: `Engine.ts` → `GRAB_DURATION` (1.5 sn), `GRAB_DAMAGE_PER_SECOND` (13).
`Enemy.ts` → `GRAB_RANGE` (1.9 m), `GRAB_WINDUP` (0.35 sn), `GRAB_COOLDOWN`
(6 sn). Sektör başına spawn: `(sektör-1) × 1.6`.

Bilinen pürüzler:
- **Sıklık.** Sektör 5'te ~6 Clinger var ve hepsi sıraya girdiğinde tutabilir.
  Aynı anda tek tutuş var ama arka arkaya gelmeleri boğucu olabilir — o zaman
  ya spawn katsayısı ya da `GRAB_COOLDOWN` artar.
- **Shove cooldown'u 5 sn, tutuş 1.5 sn.** Yani üst üste iki tutuşta ikinciye
  botu yetiştiremiyorsun. Bilerek: hayvanın ve silahın da bir işi olsun.
- **Hayvan kurtarması strike'a bağlı.** Kedi (WATCH) hiç strike yapmadığı için
  kurtaramıyor — karakterine uygun ama oyuncu bunu bilmiyor. Kedinin kartına
  bir satır eklenebilir.

### Sıradaki tip yok — kadro tamam sayılabilir
7 tip + boss. [Roster araştırmasındaki](zombie-roster-research.md) yedi rolün
altısı dolu; boş kalan tek şey "alan reddi"nin tam hâli (Bloater yarım
karşılıyor). Yeni tip yerine artık **İşaretliler katmanı** daha çok getirir.

### İşaretliler *(katman)*
[Plan yazılı](enemy-ai-plan.md) — Yelekli, Çığlıkçı-nitelik, Öfkeli, Şişkin.
**Revizyon:** Yelekli hasar azaltma değil **yön** tabanlı olsun (L4D2'nin Riot
Infected'ı gibi: önden zırhlı, arkadan çıplak). `yaw` alanımız zaten var,
bedavaya geliyor. Tavan: sektör 3'ten önce yok, aynı anda en fazla 3.

### AI planının fazları
Öneri sırası **3 → 4 → 1 → 2 → 5**:
- **Faz 3** — her zamanlama Min/Max aralığı olsun (çok ucuz)
- **Faz 4** — sıra bütçesi tipe ayrılsın: melee 3–9, heavy (Butcher/Burster) 1–2
- **Faz 1** — `WINDUP → LUNGE → RECOVER`, temas hasarı sürtünmeye insin *(büyük iş, dengeyi baştan ölçmek gerek)*
- **Faz 2** — sırayı 6.5 sn'lik sayaç değil saldırının kendisi tutsun
- **Faz 5** — spawn sonrası 0.3–0.6 sn uyanma duraklaması (kozmetik)

### Küçük ve bağımsız
- **Ses "gürültü çeker" kuralı genellensin.** Gürültü sayacı artık var
  (`Engine.noise`) ama sadece Çığlıkçı doğuruyor. Patlamalar ve fişek de
  sayaca yazabilir; ya da yüksek gürültü doğrudan sıra bütçesini biraz
  açabilir — "gürültü yaptın, daha fazlası seninle ilgileniyor".
- **Gürültü göstergesi.** Şu an oyuncu sayacı görmüyor, sadece sonucunu
  (toast + Çığlıkçı). 7DTD de göstermiyor. Ama silah rafında artık
  "Silent / Quiet / Loud / Deafening" etiketi var, yani en azından seçim
  bilinçli yapılabiliyor.
- **Rook'un grit'i (60) izlensin.** 5 numaralı değişiklikten sonra daha hızlı
  yıpranıyor. Her sokakta yere yığılıyorsa ya grit yükselir ya da HARRY rolüne
  "kondisyon düşünce geri çekil" eklenir. Önce oynayıp bakılacak.

---

## REDDEDİLDİ *(ve nedeni — yeniden önerilmesin)*

| Fikir | Neden hayır |
|---|---|
| **Hades'in `ActiveEnemyCap`'i (ekranda ≤8 düşman)** | Oyunu siler. Onların baskısı saldırı çeşitliliğinden, bizimki hacimden geliyor. Sıra sistemi zaten aynı soruya gövde sayısını düşürmeden verilmiş cevap |
| **Düşman başına coroutine/thread mimarisi** | 8 düşman için doğru, 34 için bütçe yok. Faz 1'deki durum makinesi bunun küçük hâli |
| **Kapak arkası davranışı (`HideAndPeekAI`)** | Pathfinding ister, bizde yok |
| **Tek hedef varsayımı** | Hades'te düşman daima Zagreus'u hedefler. Nan'ın yemi bizim farkımız, düzleştirmeyelim |
| **İşaretlileri yüzdeyle dağıtmak** | %20 × 34 = 7 elit, Hades'in tüm odasından fazla. Oran değil **tavan** |
| **Nitelik başına ayrı renk** | Ekranda 34 gövde var, dördü aynı anda sahnede olabilir, karışır. Hepsi tek renk — "bunda bir tuhaflık var" der, tuhaflığı davranışından okunur |
| **Bristle'ın "en uzak hedef" mantığını değiştirmek** | Hücum koşu mesafesi ister. bug.md 14'ün düzeltmesiydi, yerinde duruyor |

---

## BİLİNEN KISITLAR *(çalışırken hatırla)*

- **Tarayıcı önizlemesi bu ortamda kare üretmiyor** (rAF duruyor), yani ekran
  görüntüsüyle doğrulama yok. Yerine: `vite`'ın SSR loader'ıyla node içinde
  headless harness — `Enemy`, `Companion`, `Player` doğrudan import edilip
  ölçülebiliyor. Bu yöntemle sıra sistemi, hayvan hedeflemesi ve reload
  doğrulandı.
- **`InstancedEnemies` örnek başına tek renk çarpanı yazıyor** — görsel ayrım
  kanalımız bu (`FLASH` / `HOT` / `PLAIN`). Yeni bir işaret buraya eklenen bir
  sabit demek.
- **Grid bir broad phase.** `query()` hücreleri bütün döndürür; "şu yarıçaptaki
  her şey" diyen her yer mesafeyi **kendisi ölçmek zorunda**. bug.md 2, 15, 16
  bu yüzden çıktı.
