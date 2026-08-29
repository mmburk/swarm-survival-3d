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

| 7 | **Kapan (Clinger)** — yedinci tip. 0.35 sn hamle, tutarsa 1.5 sn hareket kilidi. Yuvarlanarak önleniyor, **F** ile kırılıyor, **hayvan** üstünden alıyor. Oyuncuya `drain()` ve `isHeld`, hayvana `penRescues` sayacı + Eli'nin yeni kehaneti geldi | `6b92de8` | Ateş etmek serbest kalıyor — silahı da alan tutuş karar değil, ara sahne olurdu |

| 8 | **İşaretliler** — `config/Marks.ts`. Dört kural (Vested / Wound Up / Swollen / Unburnt), tipe göre yasaklar, sektör 3'ten sonra tavanlı. Tek soğuk renk, pin board'da kartları, ilkinde toast | `6045800` | Vested yön tabanlı: omzunu geçersen plaka bitiyor. Delici ve patlama zaten tanımıyor |

| 9 | **Faz 3 — her sayı bir bant.** `Profile` altı `Range` taşıyor (`pace`, `standoff`, `turn`, `rest`, `windup`, `recover`), hepsi gövde başına spawn'da çekiliyor. Dört sabit silindi | `0f19467` | 22 m'den gelen 20 shambler artık 8.7 metreye yayılmış varıyor |
| 10 | **Faz 4 — sıra üç kuyruğa ayrıldı.** melee / heavy (Butcher+Burster) / grab (Clinger). Çığlık yalnız melee'yi açıyor | `0f19467` | Sektör 5'te 3 butcher + 3 burster varken sadece 2'si saldırabiliyor, 5 clinger'dan 1'i tutabiliyor |

| 11 | **Faz 1 — vuruşun hazırlığı.** `NONE → WINDUP → STRIKE → RECOVER`, üç melee tipinde. Taahhütlü hamle, siluetle tell, temas hasarı sürtünmeye indi | `94fbb12` | Duran oyuncu 19.6 → 12–14 dps, ama sektör 9'da 27.6 → 34: eskiden kalabalık i-frame'de doyuma ulaşıyordu |

| 12 | **Faz 2 — sırayı hamle bitiriyor.** `turnSpent`, sayaç güvenlik ağına indi (2× turn). Devredilen gövde `standoff × 0.42`'de asılı kalıyor | `8618ae8` | Devir 0.85 → 1.56/sn (hamle başına bir devir). Hasar %5–15 düştü, hâlâ Faz 1 bandında |

| 13 | **Faz 5 — uyanma anı.** `Profile.wake` bandı, gövde rastgele yönle doğup oyuncuyu buluyor, vurulunca uyanma kesiliyor | `145e466` | **AI planının beş fazı da bitti.** Bundan sonrası ayar, ve ayarın yeri masa değil oyun |
| 14 | **Ses Faz 0 — temizlik ve kontrol.** 10 ölü metot silindi (692 → 436 satır), settings kartına ses kaydırıcısı (`DisplaySettings.volume`, kayıtta duruyor), `?audio=test` ile 24 olayı tuşa bağlayan dinleme tezgâhı | `a116ef9` | **Ses planının MVP maddesi bitti.** Kaydırıcı sesin yüksekliğine dokunan her işten önce gelmesi gerekendi; tezgâh da bundan sonraki her dinleme turunu kısaltan şey |
| 15 | **Ses Faz 1 — varyasyon.** Tamponda rastgele offset (`bug.md` #11 kapandı) + atış başına sapma: frekans ±%6, seviye ±%8, süre ±%4, gecikmeli katmanlar ±%15. Hepsi `noiseBurst`/`thump`'ın içinde, yani 24 olayın hepsi aldı | `2823528` | 6 atışta 6 farklı offset, filtre 3079–3340 Hz (yazılı 3200). **Yazıldı, dinlenmedi** — dört sabit de tahmin, kabul kriteri kulakta |

---

## SIRADA

### Çığlıkçının dengesi *(oynayıp bakılacak)*
Yapıldı, ama masa başında ayarlandı. İzlenecek sayılar `Engine.ts` tepesinde:
`SCREAM_LANES` (6), `SCREAM_LANE_DURATION` (5 sn), `NOISE_THRESHOLD` (120),
`NOISE_DECAY` (2.5). Duruşu ve temposu artık `PROFILES.SCREAMER` bantlarında:
`standoff` 14.0–16.5, `windup` 1.0–1.45, `recover` 7.5–11.0.

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
Sayılar: `Engine.ts` → `GRAB_DURATION` (1.5 sn), `GRAB_DAMAGE_PER_SECOND` (13),
grab bütçesi `updateTurns` içinde. `Enemy.ts` → `GRAB_RANGE` (1.9 m); hamle ve
bekleme artık `PROFILES.CLINGER.windup` (0.30–0.42) ve `.recover` (5.0–7.5).
Sektör başına spawn: `(sektör-1) × 1.6`.

Bilinen pürüzler:
- ~~**Sıklık.** Sektör 5'te ~6 Clinger var ve hepsi sıraya girdiğinde
  tutabilir.~~ **Faz 4 çözdü:** grab bütçesi sektör 5'e kadar 1, sonra 2.
  Beşi de sokakta ama sırası olan bir tanesi.
- **Shove cooldown'u 5 sn, tutuş 1.5 sn.** Yani üst üste iki tutuşta ikinciye
  botu yetiştiremiyorsun. Bilerek: hayvanın ve silahın da bir işi olsun.
- **Hayvan kurtarması strike'a bağlı.** Kedi (WATCH) hiç strike yapmadığı için
  kurtaramıyor — karakterine uygun ama oyuncu bunu bilmiyor. Kedinin kartına
  bir satır eklenebilir.

### Sıradaki tip yok — kadro tamam sayılabilir
7 tip + boss. [Roster araştırmasındaki](zombie-roster-research.md) yedi rolün
altısı dolu; boş kalan tek şey "alan reddi"nin tam hâli (Bloater yarım
karşılıyor). Yeni tip yerine artık **İşaretliler katmanı** daha çok getirir.

### İşaretlilerin dengesi *(oynayıp bakılacak)*
Sayılar `config/Marks.ts` tepesinde: `VEST_SOAK` (9), `FRENZY_SPEED` (1.55),
`FRENZY_DURATION` (2 sn), `MARK_SCRAP_BONUS` (2), `MARK_SCORE_MULTIPLIER`
(1.6). Tavan ve şans `Engine.markBudget()` / `markFor()` içinde (%35).

**Plandan sapma:** dördüncü işaret "Çığlıkçı-nitelik" olacaktı ama Çığlıkçı
tam tip oldu, o yüzden yerine **Unburnt** kondu (L4D2'nin Hazmat'ı). Sebep:
fişeğin (Q) oyunda hiçbir karşı oyunu yoktu — artık var.

Bilinen pürüzler:
- **Vested'ın açısı 0.2 eşiğinde**, yani ~70°'den sonrası çıplak. Ölçüldü:
  0/45/70° → 15 hasar, 90/110/135/180° → 24. Oynarken plaka fazla kolay
  aşılıyorsa eşik 0'a, fazla zorsa 0.4'e çekilir.
- **Hayvanlar plakayı tanıyor** (delici değiller). Rook 16 → 7 hasar. Ayı 75
  ve domuz 45 hâlâ iş görüyor. Bilinçli ama sinir bozucu olabilir.
- ~~**Can bonusu yok.**~~ Hâlâ yok, ve olmayacak — ama hızlı olan kısım geldi:
  Faz 1 ile birlikte işaretli gövdeye `windup × 0.6` yazıldı (`Enemy.ts`,
  spawn'da). Yani "elit" hissi kalınlıktan değil, okumak için daha az zaman
  bırakmaktan geliyor. **Oynarken bakılacak:** kalabalıkta %40 kısalmış bir
  hamle hâlâ okunabiliyor mu, yoksa işaretli olan tek haksız gövde mi.

### AI planı bitti — sıra oynamakta
Beş fazın beşi de yapıldı. **Ama son sekiz iş masa başında ayarlandı ve
hiçbiri oynanmadı.** Yukarıdaki her başlığın altında "oynayıp bakılacak"
notu ve hangi sabitin çevrileceği yazılı. Sıradaki en değerli şey yeni bir
sistem değil, bir koşu oynayıp bu notları doldurmak.

Oynarken bakılacak sıra (en çok şüphe duyulandan aza):
1. **Faz 1'in dengesi** — duran oyuncu sektör 1'de 12–14 dps alıyor, eskiden
   19.6'ydı. Fazla yumuşaksa `STRIKE_MULTIPLIER` 2.0.
2. **Kaçan oyuncu neredeyse hiç hasar almıyor** (1.8 dps). Clinger ve Screamer
   bunu gerçek sokakta telafi ediyor mu, ölçümde onlar yoktu.
3. **Okunabilirlik** — 34 gövde varken kolların geri çekilmesi hamleyi
   anlatıyor mu? İşaretlilerin soğuk rengi Burster'ın sıcak sarısından
   ayrılıyor mu? Çığlıkçının sarkık çenesi 15 metreden seçiliyor mu?
4. **Çığlık + gürültü** — bir sokakta kaç Çığlıkçı geliyor, ön safın 4'ten
   10'a çıkması panik mi yaratıyor yoksa duvar mı?

### Faz 2'nin dengesi *(oynayıp bakılacak)*
İki ayar noktası: `Enemy.ts` içindeki halka çarpanı (`standoff * 0.42`,
devredilen gövdenin ne kadar geri çekildiği) ve `PROFILES.*.rest` bandı.

**Plandan sapma:** plan `restTimer = kendi RECOVER süresi` diyordu (1.0–1.7
sn). Çok hızlı: gövde devrediliyor, bir saniye sonra yine en yakın olduğu için
sırayı geri alıyor, yeni gelen bumpleniyor. `rest` bandı (3.0–6.0) korundu.

Bilinen pürüz:
- **Kaçan oyuncuda hasar 4.2 → 1.8 dps'ye indi** (sektör 5). Hamle sayısı aynı
  (0.39 → 0.38), yani aynı sayıda hamle atılıyor ama daha azı tutuyor. Saf
  kiting zaten çok güvenliydi, şimdi daha da güvenli. Ölçümde Clinger ve
  Screamer yoktu — gerçek sokakta cezayı onlar veriyor. Yine de fazla
  yumuşaksa halka çarpanı düşürülür.

### Faz 1'in dengesi *(oynayıp bakılacak)*
Sayılar `Enemy.ts` tepesinde: `SWING_REACH` (1.45), `STRIKE_TIME` (0.18),
`STRIKE_LUNGE` (6.0), `STRIKE_MULTIPLIER` (1.75). Sürtünme `Engine.ts`
tepesinde: `FRICTION_INTERVAL` (1.1), `FRICTION_SHARE` (0.25),
`FRICTION_MAX_BODIES` (3).

Bilinen pürüzler:
- **Kaçan oyuncu neredeyse hiç hasar almıyor** (0.6–1.8 dps). Bilerek: cezayı
  artık Clinger (tutuş), Screamer (halka dönüyor), Bloater (menzilli) ve
  Burster veriyor. Ama saf kiting fazla güvenliyse `SWING_REACH` veya
  `STRIKE_LUNGE` artırılabilir.
- **Sektör 1 eskisinden hafif** (19.6 → 12–14). İlk sokakların yeni oyuncuya
  nefes vermesi iyi, ama fazla yumuşaksa `STRIKE_MULTIPLIER` 2.0'a çıkar.
- **Hamle sesi sadece ıskalayınca çalıyor** (0.22 sn'de bir, 4.5 m içinde).
  İsabet edenin sesi zaten `playPlayerHurt`. Kalabalıkta yeterli mi belirsiz.

### Ses Faz 1'in dinlenmesi *(dinlenecek — koddan geçti, kulaktan geçmedi)*
Yazıldı (15 numara) ama **bu ortamda kulak yok.** Dört sabit `AudioManager.ts`
tepesinde: `VARY_FREQ` (0.06), `VARY_GAIN` (0.08), `VARY_TIME` (0.04),
`VARY_DELAY` (0.15). Hepsi tahmin.

Dinleme listesi — `?audio=test` açıp:
1. **1** tuşuna üst üste hızlı bas (Ranger). Tekrar hâlâ duyuluyor mu? Duyuluyorsa
   `VARY_FREQ` ve `VARY_GAIN` yükselir.
2. **3** tuşuna bas (Çifte). Slap-back tek bir "çifte atış" kalıbı gibi mi
   duruyor, yoksa dağıldı mı?
3. Ters yön: silahın **karakteri** bozuldu mu? Ranger'la Marksman hâlâ iki ayrı
   silah gibi mi? Bozulduysa sayılar yüksek demektir.

Cevap madde başına tek satır yeter; ayarı ben yaparım.

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
