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
| 16 | **Üç küçük iş.** Gürültü kuralı genellendi (patlama 18, Burster 9, fişek 30); Çığlıkçı minimap'te içi boş kare oldu; kedinin kartı Clinger'ı alamadığını söylüyor | `1ac455f` | Üçü de "küçük ve bağımsız" listesinden. Gürültünün ikinci yarısı (sıra bütçesini açması) bilerek yapılmadı |
| 17 | **`bug.md` #8 — 30 fps altı ağır çekim.** `planSteps()`: kare zamanı `maxDelta`'yı aşmayan eşit adımlara bölünüyor, `update()` o kadar kez çağrılıyor, `render()` bir kez. `MAX_SUBSTEPS` 3 | `6983f60` | 20 fps'te hız %66 → **%100**; 30 fps ve üstünde adım sayısı 1, yani sağlıklı makine hiçbir şey ödemiyor. **Bug listesi ilk kez boş** |
| 18 | **Ses Faz 2, 3, 5 ve Faz 4'ün üçte ikisi.** Prosedürel oda (üç mekân, kuru/ıslak yolu); panning + mesafe zayıflaması; zombi vokalleri, dört ses tavanı, ölüm sesi; ayak sesi, spawn ve slam telegraph'ı; baskıya bağlı yatak | `7e2c658` | **Ses planının beş fazı da yazıldı.** Hiçbiri dinlenmedi — her fazın altında ölçüm var, hiçbirinin altında kulak yok |
| 19 | **Ölçü aleti, ve bulduğu iki şey.** `AudioMeter.ts` her sesi offline render edip ölçüyor (seviye / tekrar / konum / oda), `?audio=test` → MEASURE. Artı sığınak ve hava ambiyansı (Faz 4 tamam) | `060c713` | **Faz 1 doğrulandı** — spektrum ve zarf atıştan atışa %13-24 oynuyor. İki bug: `thump()` her seferinde aynı fazdan başlıyordu, ve `ctx.resume()`'un promise'i hiç yakalanmıyordu |
| 20 | **Sahne ölçümü, ve Harvester'ın düzeltilmesi.** Metre artık gerçek bir çatışma parçasını tek seferde render ediyor (hava + dört vokal + ateş) ve katman çıkararak ölçüyor. Harvester sokağın üstüne %0.2 dB çıkıyordu — Q açıldı, seviye kalktı, altına vuruş kondu | `5aff88d` | **0.2 → 3.4 dB**, Stutter'la aynı yerde. Ölüm/isabet dengesine dokunulmadı: ölçüldü, ölüm karışıma 1 dB ekliyor |
| 21 | **Dövüş harness'ı.** `npm run combat` — sokağı oyunun kendi kurallarıyla koşturuyor (`Enemy.updateAI`, `SectorManager.plan`, `Engine.updateTurns`, yeni ayrılan `Engine.pressBodies`). Oyuncu bir kural: duruyor ya da daire çiziyor | `e6e3657` | Hiçbir kural kopyalanmadı, hepsi prototip üzerinden çağrılıyor. Kopyalanan kural sessizce yanlışa döner |
| 22 | **`STRIKE_LUNGE` 6.0 → 8.5.** Kaçan oyuncuya ölçülen tek temiz kol | `23a2cae` | 14 tohumda: kaçan +%6–23, duran +%1–2. Şerit bütçesi hiçbir şey yapmıyor, `SWING_REACH` ise kaotik |
| 23 | **Winded — hayvan nefesi kesilince çekiliyor.** %20'de bırakıyor, %50'de dönüyor (histerezis); geri çekilme oyuncuya değil **kalabalıktan uzağa** | `23a2cae` | Rook'un yere yığılması yarıya indi (0.4 → 0.2). Grit'e dokunulmadı: sorun "az dayanıyor" değil, **durmayı bilmiyor** idi |
| 24 | **Gürültü uyarısı.** Sayaç hâlâ gizli; %75'te bir satır: "The street is listening." %40'a inince yeniden kurulur | `23a2cae` | Sayacı besleyen üç yeni şeyin (patlama, Burster, fişek) etiketi yoktu |
| 25 | **Okunabilirliğin ölçülebilen yarısı.** Tint'ler arası algısal mesafe (CIE76) ve silüet farkının piksel karşılığı | `57aca65` | İşaretli vs Burster **ΔE 84** — karıştırılamaz. Çığlıkçının çenesi 1080p'de 10 px, diğerleri 4 px. Ve projeksiyon ortografik: **mesafe boyutu hiç değiştirmiyor**, zorluk kalabalıktan geliyor |

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
- ~~**Minimap'te ayırt edilmiyor.**~~ **Yapıldı (16 numara):** Çığlıkçı artık
  **içi boş** bir kare, diğerleri dolu. Ayrı renk değil — soğuk mavi
  işaretlilerin, kehribar kapının; anahtar isteyen harita kimsenin okumadığı
  haritadır. Aynı renk, farklı işaret: "hâlâ onlardan biri, ama ötekilerin
  yaptığını yapmıyor."
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
- ~~**Hayvan kurtarması strike'a bağlı.**~~ **Yapıldı (16 numara):** kedinin
  kartı artık "she cannot pull a Clinger off you either, and will not try"
  diyor. Davranış değişmedi — değişen, oyuncunun bunu satın almadan önce
  bilmesi.

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

### Masadan çıkacak iş kalmadı
İki planın ikisi de bitti. AI planı beş fazın beşi, ses planı beş fazın beşi
(Faz 4'ün ikisi hariç, sebebi aşağıda). Açık bug listesi boş.

**Geriye kalan her şeyin ya kulağa ya oynanışa ihtiyacı var:**

| Ne | Ne lazım |
|---|---|
| Sekiz "oynayıp bakılacak" başlığı (aşağıda) | bir koşu |
| Ses Faz 1–5'in bütün sabitleri | `?audio=test`, aşağıdaki liste |
| Sığınak ambiyansı + hava yatağı (Faz 4'ün kalanı) | önce odanın dinlenmesi |
| Gürültünün sıra bütçesini açması | önce yeni gürültü kaynaklarının oynanması |
| Ses Faz 6 (gerçek foley + beste) | MVP dışı, ve **karar** — 1–5 dinlenmeden verilemez |

**Uyarı, ve uyarının yarısının kalkması.** Planın kendi yöntemi faz başına
2-3 dinleme turu diyordu ve beş faz üst üste dinlenmeden yazıldı. Bunun
üstüne bir **ölçü aleti** kondu (19 numara): `?audio=test` → MEASURE her sesi
offline render edip ölçüyor. Artık "aritmetik doğru" demiyoruz, **sesin
kendisi** ölçülüyor — sadece beğenilip beğenilmediği ölçülmüyor.

Nesnel yarısı kapandı ve bir şey de yakaladı: dalga biçimi korelasyonuyla
bakıldığında Faz 1 çalışmıyor gibi göründü (0.72). Metrik yanlıştı — rastgele
fazlı iki sinüsün |korelasyon| beklentisi zaten 2/π ≈ 0.64, ve kulak fazı
duymuyor. Doğru soru "aynı spektrum, aynı zarf mı" ve cevap **%13–24 oynuyor**,
yani Faz 1 çalışıyor. *Yanlış ölçüm yine de gerçek bir bug buldu:* `thump()`
her seferinde faz sıfırdan başlıyordu.

**Kalan yarısı hâlâ kulakta.** Ölçüm dengesizliği gösterir, hangisinin doğru
olduğunu söylemez — aşağıdaki liste bu yüzden duruyor.

### Ses için dinleme listesi *(tek oturum, `?audio=test`)*

**Faz 1 — varyasyon.** 1'e üst üste hızlı bas: tekrar duyuluyor mu?
(`VARY_FREQ`/`VARY_GAIN` yükselir.) 3'e bas: slap-back dağıldı mı? Ters yön:
Ranger'la Marksman hâlâ iki ayrı silah mı? (Değilse sayılar yüksek.)

**Faz 2 — oda.** ROOM düğmeleriyle aynı sesi üç mekânda çal. BASEMENT gerçekten
kapanıyor mu, UNDERPASS açılıyor mu? Silahın odası fazla mı? (`WET_GUN`.)

**Faz 3 — konum.** POS kaydırıcısını sola al, 5'e bas: sol mu? Merkeze al,
tekrar: merkez mi? Sonra oyunda: dört ses bilgi mi çamur mu, ölüm sesi
zincirleme öldürmede fazla mı?

**Faz 5 — yatak.** DRONE aç, BED'i 0'dan 100'e gezdir. Fark ediliyor mu
(kötü), yoksa yalnız durduğunda mı (iyi)?

**Ölçümün işaret ettiği iki denge — ikisi de karara bağlandı (20 numara).**
Tek başına ölçmek yetmedi; ikisi de "diğerlerinin yanında" sorusuydu, o yüzden
metre'ye sahne tabloları eklendi.

- **Harvester düzeltildi.** Hava ve dört gövdenin üstüne yalnız **+0.2 dB**
  çıkıyordu, yani ateş ederken kendi silahını duyamıyordun. Sebep seviye değil
  biçimdi: Q 3.5'lik bandpass enerjinin çoğunu atıyor ve bu, raftaki tek alt
  ucu olmayan silahtı. Şimdi **+3.4 dB**, Stutter'la birebir aynı yerde.
  *Kurgu değişmedi* — sokağın duyduğu `Weapons.noise` ve orası 0.1'de duruyor.
- **Ölüm/isabet olduğu gibi bırakıldı.** Ölçüldü: ölüm karışıma **1 dB**
  ekliyor ve üç saniyedeki dört ölüm bir el bombası kadar. Tek başına 18 dB'lik
  fark karışımda görünmüyor, çünkü silah ikisini de bastırıyor.

**Metre'nin kendi hatası:** tek atışlık tepeler koşudan koşuya ±2-3 dB oynuyor.
3 dB'den küçük farklar için tabloları kullanma.

### AI planı bitti — sıra oynamakta
Beş fazın beşi de yapıldı. **Ama son sekiz iş masa başında ayarlandı ve
hiçbiri oynanmadı.** Yukarıdaki her başlığın altında "oynayıp bakılacak"
notu ve hangi sabitin çevrileceği yazılı. Sıradaki en değerli şey yeni bir
sistem değil, bir koşu oynayıp bu notları doldurmak.

Oynarken bakılacak sıra (en çok şüphe duyulandan aza):

1. ~~**Faz 1'in dengesi**~~ ve ~~**kaçan oyuncu**~~ — **ölçüldü** (21 numara).
   Aşağıdaki başlıkta duruyor.
2. ~~**Clinger ve Screamer kiting'i telafi ediyor mu?**~~ **Hayır, ölçüldü.**
   Ve nedeni fazın tasarımını ilgilendiriyor: şerit bütçesi kaçan oyuncuya
   karşı bağlayıcı kısıt **değil**.
3. **Okunabilirlik** — yarısı ölçüldü (25 numara), yarısı göz istiyor.

   **Ölçülen:** renk ayrımı sorun değil. İşaretlinin soğuk rengiyle Burster'ın
   sıcak sarısı arasında **ΔE 84** var (üç ten tonunda 72–84); 2.3 "kimse
   ayırt edemez", 10 "bir bakışta belli". Yani kartın sözü — *"bir şey
   patlayacak" ile "bunda bir tuhaflık var" asla karışmasın"* — tutuyor.
   İşaretli düz gövdeden ΔE 28 ayrı: fark edilir ama bağırmıyor, ki niyet
   buydu.

   **Ölçülen 2:** Çığlıkçının sarkık çenesi 1080p'de **10 piksel**, diğer her
   tipte 4; 5 piksel daha aşağıda duruyor. Kendi 0.92 ölçeğinden sonra 9.
   720p'de 7'ye 3.

   **Ve bir düzeltme:** "15 metreden seçiliyor mu" sorusu yanlış kurulmuş.
   Kamera **ortografik** — mesafe hiçbir şeyin ekrandaki boyutunu
   değiştirmiyor. Uzaktaki Çığlıkçı yakındakiyle aynı büyüklükte; zor olan
   arada duran 33 gövde. Yani tell'in **küçülmeye** değil **kalabalığa**
   dayanması gerekiyor.

   **Göz isteyen kısım:** 9 piksel 34 gövdenin arasında yeter mi, ve kolların
   geri çekilmesi hamleyi anlatıyor mu.
4. **Çığlık + gürültü** — bir sokakta kaç Çığlıkçı geliyor, ön safın 4'ten
   10'a çıkması panik mi yaratıyor yoksa duvar mı? *Sayısı ölçüldü (etkisi
   yok), ama "panik mi duvar mı" bir his ve o oynanarak bilinir.*

### Harness ne buldu *(`npm run combat`)*

**Kural:** oyuncu ateş etmiyor, yani sokak hiç incelmiyor ve 34 gövde 25 saniye
boyunca üstünde. Mutlak sayılar bu yüzden **stres testi**, tahmin değil.
Karşılaştırmalar dürüst olan kısım.

**Kaçmak durmaktan 71–87% daha güvenli** (sektör 1 → 9). Bu, defterin
"kaçan oyuncu neredeyse hiç hasar almıyor" şüphesinin sayısı.

**Uzmanlaşmış tipler kiting'i cezalandırmıyor.** Kaçan oyuncuya karşı
melee-only kadro ile tam kadro arasında fark: +17% / +86% / −20% / +15% /
−3% / −13%. Ortalama sıfır. **Sebep 34'lük tavan:** Çığlıkçı 15 metrede
duruyor, Kapan ara sıra tutuyor, ikisi de yerini bir melee gövdeden alıyor.

**Ve asıl bulgu:** altı ekstra şerit (kalıcı bir çığlık) kaçan oyuncuda hasarı
sektör 9'da **%25 düşürüyor.** Şeritler kimin *hücum edeceğine* karar veriyor,
ve hücum etmek hareketli hedefe karşı başarısız olan şey. Devreye giren gövde
halkadan çıkıp arkanda diziliyor; halkadaki gövde ise sen dönerken **önüne**
geliyor. Yani ön safı açmak, seni gerçekten yaralayan şeyi dağıtıyor.

Bunun üç sonucu var ve üçü de yukarıdaki maddeleri kapatıyor:
- Clinger/Screamer'ın kiting'i cezalandırmaması bir ayar hatası değil, **şerit
  sisteminin yapısı.**
- Gürültünün şerit bütçesini açması fikri **reddedildi** (aşağıdaki tabloda).
- Kaçmaya karşı doğru kol **erişim**, ve ölçülen tek temizi `STRIKE_LUNGE`.

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

### Faz 1'in dengesi *(ölçüldü, 22 numara)*
Sayılar `Enemy.ts` tepesinde: `SWING_REACH` (1.45), `STRIKE_TIME` (0.18),
`STRIKE_LUNGE` (**8.5**, eskiden 6.0), `STRIKE_MULTIPLIER` (1.75).

**`STRIKE_LUNGE` neden değişti.** Defter "saf kiting fazla güvenliyse
`SWING_REACH` veya `STRIKE_LUNGE` artırılabilir" diyordu. Harness kiting'in
durmaktan %87 daha güvenli olduğunu ölçtü, ve iki kolu ayrı ayrı denedi:

| | kaçan (s1/s6/s9) | duran (s1/s6/s9) |
|---|---|---|
| lunge 6.0 → 8.5 | **+11% / +23% / +6%** | +19% / +1% / +2% |
| lunge 6.0 → 11.0 | +23% / +43% / +29% | −23% / −15% / −12% |
| reach 1.45 → 1.8 | +9% / +1% / +11% | **−38% / −32% / −35%** |
| reach 1.45 → 2.2 | +34% / +49% / +24% | −30% / −18% / −17% |

`SWING_REACH` bir kadran değil, yazı-tura: duran oyuncunun aldığı hasarı
değere göre her iki yöne de %30 savuruyor. 11'lik lunge ise duran oyuncuyu
**rahatlatıyor**, çünkü gövde onu aşıp geçiyor. 8.5 tek temiz nokta: kaçanı
kaldırıyor, duranı yerinde bırakıyor — zaten ezilmekte olanın daha fazlasına
ihtiyacı yok.

14 tohumluk ortalama. 5 tohumda gürültü belirgindi; kalabalık dinamiği kaotik. Sürtünme `Engine.ts`
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
- ~~**Ses "gürültü çeker" kuralı genellensin.**~~ **Yapıldı (16 numara).**
  Sayaca artık patlama (`NOISE_BLAST` 18), Burster (`NOISE_BURST` 9) ve fişek
  (`NOISE_FLARE` 30) da yazıyor. Fişek en pahalısı, çünkü kural "ne kadar
  yüksek" değil "kendini ne kadar belli ettin" — fişek zaten bunun için
  atılıyor. Burster en ucuzu, çünkü üçü içinde oyuncunun karar vermediği tek
  şey o.
  **Yapılmadı:** aynı maddedeki ikinci seçenek — yüksek gürültünün doğrudan
  **sıra bütçesini** açması. Madde "ya da" diyordu; ikisini birden yapmak
  denenmemiş bir sistemde iki bilinmeyen demek. Bütçe versiyonu duruyor, ama
  önce yukarıdakinin oynanması lazım.
- **Gürültü göstergesi.** Şu an oyuncu sayacı görmüyor, sadece sonucunu
  (toast + Çığlıkçı). 7DTD de göstermiyor. Ama silah rafında artık
  "Silent / Quiet / Loud / Deafening" etiketi var, yani en azından seçim
  bilinçli yapılabiliyor. **Yeni sebep:** artık fişek ve patlama da yazıyor,
  yani sayacı besleyen üç şey daha var ve hiçbirinin etiketi yok.
- ~~**Rook'un grit'i (60) izlensin.**~~ **Ölçüldü ve düzeltildi (23 numara).**
  Evet, her sokakta yere yığılıyordu. Defterin iki çözümünden **ikincisi**
  seçildi: grit'i yükseltmek "bu köpek daha çok dayanır" demek olurdu, oysa
  yanlış olan dayanıklılığı değil — **durmayı bilmiyor olması**ydı.

  `WINDED_IN` (0.2) / `WINDED_OUT` (0.5), `Companion.ts` tepesinde. Tek eşik
  değil iki: tam eşiğin üstünde oturan bir hayvan saniyede bir dövüşe girip
  çıkar, ki bu hiç çekilmemekten kötüdür.

  **Geri çekilme oyuncuya değil, kalabalıktan uzağa.** Önce heel denendi ve
  neredeyse hiçbir şey yapmadı — oyuncu da kalabalığın içinde, yani onun yanı
  aynı gövdelerin arası. Mouser'ın hep kullandığı numara doğrusuydu: senin
  **arkana**, tasmanın ucuna.

  | | kondisyon kalan (s2/s6/s9) | yere yığılma (s6/s9) |
  |---|---|---|
  | öncesi | 48% / 24% / 12% | 0.4 / 0.2 |
  | winded ile | 48% / **28%** / **15%** | **0.2 / 0.0** |

  Bristle'a ve Mouser'a hiç dokunmuyor — biri o kadar düşmüyor, diğeri zaten
  çekiliyor. Doğru şekil: içeri giren hayvan için bir kural.

- **Mouser da yıpranıyor, ve o hiç dövüşmüyor.** Sektör 6–9'da sokağı %16–19
  kondisyonla bitiriyor — Rook'tan çok da iyi değil. Tasması 3 metre, yani
  oyuncuyla birlikte kalabalığın içinde duruyor. Bilerek mi, değil mi:
  oynanacak.

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
| **Gürültünün sıra bütçesini açması** | Yazıldı, ölçüldü, geri alındı. Dolu sayaçta iki ekstra şerit kaçan oyuncuda hasarı %1–4 oynattı; kalıcı açık tutulan altı şerit ise **hiç** oynatmadı, sektör 9'da %25 *düşürdü*. Şeritler kimin hücum edeceğine karar veriyor ve hücum, hareketli hedefe karşı başarısız olan şey. Premisi çürük, mekanizma değil |
| **Rook'un grit'ini yükseltmek** | Ölçüm sorunu doğruladı ama sebebi dayanıklılık değildi. Sayı yerine davranış: `winded` (23 numara) |

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
- **Dövüş harness'ı var:** `npm run combat`. Yeni bir denge sayısına dokunmadan
  önce çalıştır, sonra tekrar çalıştır. Oyuncu ateş etmiyor (opsiyonel
  `killEvery` dışında), yani mutlak sayılar stres testi — **karşılaştırma**
  için kullan. Kalabalık dinamiği kaotik: 5 tohum gürültülü, 14 tohum oturuyor.
- **Grid bir broad phase.** `query()` hücreleri bütün döndürür; "şu yarıçaptaki
  her şey" diyen her yer mesafeyi **kendisi ölçmek zorunda**. bug.md 2, 15, 16
  bu yüzden çıktı.
