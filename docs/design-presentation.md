# LAST LIGHT — Tasarım Sunumu

*Bir game designer'a gösterim için hazırlanmış tam döküm. Her hat ayrı bölüm;
sayılar doğrudan koddan alındı, tahmin olan yerler açıkça "tahmin" diye
işaretlendi.*

Build: TypeScript + three.js (r185) + Vite · ~10.700 satır · 0 dış görsel/ses
asseti (her şey prosedürel) · tarayıcıda çalışır.

---

## 0. TEK CÜMLE

> **LAST LIGHT**, salgın sonrası ölü bir Amerikan kasabasında geçen, izometrik,
> top-down bir roguelite: her gece bir sığınaktan çıkıyorsun, birkaç şehir
> sektörü temizliyorsun, telsizde hâlâ yayın yapan beş kişiden birinden yardım
> alıyorsun ve ya kapıdan geri giriyorsun ya da girmiyorsun.

**İskelet açıkça *Hades*'ten alınmış.** Bu gizlenmiyor, aksine sunumun omurgası:
Olympos'un tanrıları → telsizdeki beş sesi; İnfernal Arms → duvardaki beş silah;
Mirror of Night → tezgâhtaki kalıcı yükseltmeler; Charon → köprü altındaki Vic;
Pact of Punishment → radyodan seçilen "Long Night" zorluk kademeleri.

**Ton kuralı (ihlal edilmez):** *Bu dünyada hiçbir şey isteyerek parlamıyor.*
Işık sadece gaz lambası, yol fişeği, namlu alevi ve kapalı gökyüzünden gelir.
Neon yok, holografik UI yok, "sci-fi mavi" yok.

---

## 1. HAT: ÇEKİRDEK DÖNGÜ

```
BAŞLIK EKRANI
    ↓
SIĞINAK (hub, düşman yok)
    │  silah seç · scrap harca · zorluk seç · kayıtlara bak · köpeği sev
    ↓  merdivenlerden çık
SEKTÖR 1 → 2 → 3 → 4 → 5 …
    │  her sektör: sokağı temizle → iki kapı açılır → birini seç
    │  sektör 5, 10, 15… = BOSS (Behemoth)
    │  sektör 3, 8, 13… = VIC (savaşsız, ticaret)
    ↓
BOSS DÜŞTÜKTEN SONRA: iki kapı
    │  "THE WAY BACK" → koşuyu bankaya yaz, sığınağa dön
    │  "RADIO CONTACT" → daha derine git
    ↓
ÖLÜM veya DÖNÜŞ → DEBRIEF → SIĞINAK
```

**Döngü uzunluğu:** en kısa tam koşu = 5 sektör (4 çatışma + 1 boss).
Oyuncu ancak boss'tan sonra çıkabiliyor — yani **taahhüt noktaları 5 sektörde
bir.** Bu bilinçli: "bir sektör daha" pazarlığını, gerçek bir bedeli olan
noktaya kadar erteliyor.

**Kalıcı olan tek şey scrap.** Ölünce boonlar, silah modifiye durumu değil ama
run-içi tüm buffler gider; scrap kalır. (Bkz. §12 — burada bilinçli bir tasarım
riski var, dürüstçe anlatılıyor.)

---

## 2. HAT: ANLIK OYNANIŞ (moment-to-moment)

### Fiil seti — 8 tuş, hepsi tek işlevli

| Girdi | Fiil | Kural |
|---|---|---|
| WASD | Yürü | Ekran uzayında okunur, kamera yaw'ına döndürülür (§16) |
| Fare | Nişan al | Zemin düzlemine raycast, karakter imlece döner |
| LMB | Ateş | Otomatik silahlarda basılı tut, diğerlerinde tek tık |
| RMB | Ağır atış | Silaha özel, uzun cooldown (3.2–5.0 sn) |
| SPACE | Yuvarlan | 0.24 sn, 21 birim/sn, **tam dokunulmazlık**, 34 stamina |
| R | Doldur | Şarjör dolmadıysa; boşalan silah kendi kendine de doldurur |
| F | İtekle (shove) | 5.5 m, 5 sn cooldown, 12 hasar + sersemletme |
| Q | Fişek at | Adrenalin dolunca, ultimate yerine geçer |
| E | Kullan | Kapı, sandık, Vic, sığınak istasyonları |
| TAB | Koşu Kâğıdı | Aktif boonlar, istatistikler (oyun durur) |

### Hissiyat katmanı (game feel)

- **Hit-stop:** her ölümde 22 ms tam durma (`hitStop`). Küçük ama zincirleme
  öldürmede vuruşun "ısırdığını" hissettiren şey bu.
- **Kamera travması:** her silahın kendi `trauma` değeri var (Stutter 0.04 →
  Widowmaker 0.40). Patlamalar 0.4, boss ölümü 0.9.
- **Dash zoom punch'ı:** ortografik kamerada FOV olmadığı için, yuvarlanırken
  `camera.zoom` 0.93'e çekiliyor — kadraj genişliyor, geri çekilme hissi
  veriyor. Ortografik kamerada "FOV kick"in doğru karşılığı budur.
- **Vuruş geri bildirimi:** düşman emissive ile 70 ms parlar, geriye itilir
  (ağırlığa ters orantılı: sprinter uçar, butcher kıpırdamaz), kan parçacığı
  çıkar, hasar sayısı ekrana düşer.
- **Oyuncu hasarı:** ceket 50 ms'de bir soluk kırmızıya döner (kırmızı ekran
  flaşı yerine karakterin üstünde okunur), 0.45 sn i-frame.
- **Streak:** 2.4 sn içinde art arda öldürme sayacı; her 4 kill'de skor çarpanı
  +1 (maks ×8), 5/12/25/50'de ekranda yazı.

### Kaynaklar (oyuncunun aynı anda yönettiği 4 sayaç)

| Kaynak | Maks | Doluş | Harcama |
|---|---|---|---|
| Sağlık | 100 (+12/rank, maks 160) | Bandaj, boon, Vic | Temas, bile, patlama |
| Stamina | 100 | 38/sn otomatik | Yuvarlanma 34 (≈0.9 sn'de bir) |
| Adrenalin | 100 | Kill başına 5.5 (≈19 kill) | Fişek (Q) |
| "Get up" | 1 (+2 meta, +boon) | — | Ölümcül hasarda otomatik: %45 canla kalk |
| Şarjör | Silaha göre 2–45 | Dolum (R) veya boşalınca otomatik | Tetik başına 1 mermi |

---

## 3. HAT: SİLAH HATTI (5 silah)

Hades'in Infernal Arms'ı. Koşu başına **bir tane** seçiyorsun, geri kalanı
duvarda kalıyor. Her silahın ayrıca bir **ağır atışı** (Aspect'in ikinci yarısı)
ve **bir field mod'u** (kalıcı, scrap'le açılır, sonra ücretsiz aç/kapa) var.

| Silah | Model | Hasar × mermi | Atış aralığı | Menzil | Delme | Şarjör / dolum | Teorik DPS | Kilit |
|---|---|---|---|---|---|---|---|---|
| **The Ranger** | Dürbünlü karabina | 24 × 1 | 0.115 sn | 34 m | 0 | 30 / 2.1 sn | ~209 | Başlangıç |
| **The Boomstick** | Kırpılmış çifte | 15 × 7 | 0.68 sn | 16 m | 1 | 2 / 1.2 sn | ~154 (tam isabet) | 150 |
| **The Widowmaker** | Sürgülü av tüfeği | 105 × 1 | 0.85 sn | 62 m | 2 | 5 / 2.5 sn | ~124 (tek hedef) / ~370 (hat) | 260 |
| **The Stutter** | Derme çatma makineli | 10 × 1 | 0.058 sn | 24 m | 0 | 45 / 1.8 sn | ~172 | 340 |
| **The Harvester** | Basınçlı çivi tabancası | 58 × 1 | 0.34 sn | 40 m | 4 | 24 / 2.2 sn | ~171 (tek) / ~853 (5'li hat) | 480 |

**Tasarım niyeti:** ham DPS'ler bilerek birbirine yakın (154–209). Fark
**nerede ve nasıl** kullanıldığında: Boomstick 16 metre içinde karar veriyor,
Widowmaker sıra hâlinde gelen kalabalığı deliyor, Harvester kuyruk hâlindeki
her şeyi tek çiviyle diziyor, Stutter isabeti hacimle telafi ediyor.

Şarjör bu tablodaki DPS'lerin hiçbirini değiştirmiyor, **ne kadar süre**
geçerli olduklarını değiştiriyor. Tetiği basılı tutarsan şarjör boşalma /
dolum oranı: Ranger %62, Boomstick %54, Widowmaker %63, Stutter %59,
Harvester %79. Yani Harvester sürekli ateş eden silah, Boomstick iki el atıp
geri çekilen silah — ikisi de aynı DPS'e sahipken.

### Ağır atışlar (RMB)

| Silah | Ağır atış | Hasar | Yarıçap | CD |
|---|---|---|---|---|
| Ranger | Rifle Grenade (ilk gövdede patlar) | 150 | 8.5 m | 4.5 sn |
| Boomstick | Breaching Slug (hattı deler) | 200 | — | 3.6 sn |
| Widowmaker | AP Round (her şeyi deler) | 320 | — | 5.0 sn |
| Stutter | Nail Bomb | 90 | 11.0 m | 4.0 sn |
| Harvester | Fan Volley (5 çivi yelpaze) | 95 ×5 | — | 3.2 sn |

### Field mod'lar (silah başına 1, kalıcı satın alma)

| Silah | Mod | Etki | Fiyat |
|---|---|---|---|
| Ranger | Long Barrel | ×1.85 hasar, +14 m, +1 delme, ×1.35 cooldown | 220 |
| Boomstick | Welded Choke | 7→5 mermi, saçılma ×0.42, +12 m, ×1.5 hasar | 260 |
| Widowmaker | Double Feed | 2 mermi, hasar ×0.62, cooldown ×0.92 | 300 |
| Stutter | Wire Brace | saçılma ×0.45, hasar ×1.5, cooldown ×1.22 | 280 |
| Harvester | Overpressure | +5 delme, ×1.2 hasar, ×1.3 cooldown | 360 |

Her mod bir **takas**: hiçbiri düz güçlendirme değil. Aynı silahın iki farklı
oynanış profilini veriyor — Hades'te aspect'in yaptığı şey.

---

## 4. HAT: DÜŞMAN HATTI (7 tip + boss)

| Tip | Can | Hız | Yarıçap | Temas hasarı | Scrap | Rol |
|---|---|---|---|---|---|---|
| **Shambler** | 34 | 2.6 | 0.85 | 12 | 1 | Taban kalabalık, hep var |
| **Sprinter** | 22 | **7.4** | 0.78 | 15 | 1 | Baskı; oyuncu hızı 8.2 — kıl payı kaçarsın |
| **Bloater** | 60 | 3.0 | 1.00 | 10 | 2 | Menzilli; mesafeyi korur, safra tükürür (2.6 sn'de bir) |
| **Butcher** | 210 | 2.9 | 1.55 | 26 | 4 | Duvar; itilmez, yolunu kapatır |
| **Burster** | 40 | 4.6 | 0.95 | 22 | 2 | Yaklaşır, 0.85 sn şişer, patlar (oyuncuya 30, etrafa 110) |
| **Screamer** | 25 | 3.4 | 0.78 | 8 | 3 | 15 m'de durur, 1.2 sn kurulur, çığlıkla ön safı 6 gövde büyütür |
| **Clinger** | 55 | 5.2 | 0.80 | 6 | 2 | 0.35 sn hamle, tutarsa oyuncuyu 1.5 sn yerinde tutar (sn'de 13 hasar) |

### AI mimarisi

- **Steering + separation.** Herkes oyuncuya yönelir; komşulardan itilme
  hesabı **3 karede bir** yapılır (id + frame % 3), maliyet böyle üçe bölünür.
- **Sıra sistemi (attack turns).** Aynı anda yalnız birkaç ceset saldırıya
  geçer: sektör 1'de 3, sektör 10'da 9 (`3 + sektör×0.7`, tavan 9). Sırası
  gelmeyen kendi halkasına (7.5–13 m) kadar yaklaşıp orada **dolanır**.
  Sıra 6.5 saniye sürer, dolan 3.5 saniye geride bekler, sonra tekrar
  girebilir. Sıralar 0.45 saniyede bir dağıtılıyor ve en yakındakiler
  alıyor — ayrıca saldırıdaki bir cesede 3 metrelik "kayyum payı" veriliyor
  ki iki ceset her kesiştiğinde sıra takırdamasın. **Sebep:** kırk cesedin
  hepsi aynı anda en kısa hattı koşarsa ortaya okunacak hiçbir şey çıkmıyor;
  otuz düşmanla beş düşman arasındaki fark yalnızca can barının ne kadar hızlı
  indiği oluyor. Sırayla gelen kalabalıkta hem hedef seçimi hem de aradan
  çıkış yolu var. Kalabalığın **boyu** aynı, değişen şey ön saf.
- **Yay çizerek yaklaşma.** Saldırıya geçen düşman nişan hattından değil,
  kendi seçtiği omuzdan geliyor: yön vektörü mesafeyle sönümlenen bir açıyla
  döndürülüyor (shambler ±0.62 rad'a kadar, butcher ±0.34, sprinter ±0.2), 3
  metrede tamamen kapanıyor — yani son birkaç metre yine düz bir hücum.
  Ölçüm: 6 metrenin ötesinde adımların oyuncuya bakan yönle örtüşmesi
  shambler'da 0.87, sprinter'da 0.98 (1.0 = cetvel gibi düz).
- **Sıranın istisnaları.** Bloater zaten menzilli ve kendi mesafesini koruyor,
  hiç sıraya girmiyor. Sektör süpürülürken (`pressAttack`) bekleme kalkıyor
  ama yay kalıyor. Hayvan yeme çektiği her şeyi de sıradan çıkarıp doğrudan
  üstüne yolluyor — yemin bütün anlamı onları bağlaması.
- **Weave (salınım).** Her düşmanın sinüs faz kayması var; sürü tek blok
  hâlinde hareket etmiyor. Sprinter hızlı ve dar salınıyor, shambler yavaş ve
  geniş.
- **Bloater kiting.** 13 m içinde geri çekilir — ama sektörde 4'ten az düşman
  kaldığında `pressAttack` açılır ve üstüne gelir. **Sebep:** son bloater'ın
  sabrınızın dışında park edip sektörü sonsuza kadar kilitlemesini engellemek.
  (Bu, playtest'ten çıkmış bir düzeltme; sunumda anlatmaya değer.)
- **Çığlıkçı ve gürültü.** Screamer sıraya hiç girmiyor (Bloater gibi menzilli
  sayılıyor), 15 metrede duruyor ve 9 saniyede bir çığlık atıyor. Çığlık
  ne doğuruyor ne de güçlendiriyor — **halkada bekleyen 6 gövdeye anında sıra
  veriyor** ve 5 saniye boyunca sıra bütçesini 6 artırıyor. Karşı oyun 1.2
  saniyelik kurulma: o sırada öldürülürse hiçbir şey olmuyor. Ayrıca oyuncunun
  gürültüsüne göre plan dışı Screamer doğuyor (7 Days to Die'ın Heat sistemi):
  her atış silahın `noise` değerini sokağın sayacına yazıyor, sayaç saniyede
  2.5 unutuyor, 120'de bir Screamer geliyor. Harvester saniyede 0.3 üretiyor —
  yani **hiç çağırmıyor**, kartındaki "the quiet ones do not call the herd"
  sözü ilk kez doğru.
- **İşaretliler (the Marked).** Sekizinci tip yerine, yedi gövdenin üstüne
  binen bir kural katmanı — L4D2'nin "uncommon common"ları, 7DTD'nin
  feral/radiated'ı ve Hades'in elit nitelikleri aynı şekle varmış:
  *kural kalabalığın üstünde durur, hangi gövdeye binebileceği kısıtlıdır, ve
  görünür.* Dördü de aynı soğuk renkte çiziliyor (`MARKED` tint) — 34 gövdenin
  ekranında dört ayrı renk okunamaz; renk "bunda bir tuhaflık var" diyor,
  tuhaflığın ne olduğunu davranış gösteriyor.

  | İşaret | Ne yapıyor | Kimde olmaz, neden |
  |---|---|---|
  | **Vested** | Öne gelen mermiden 9 hasar yiyor. Delici mermi, patlama ve **baktığı yönün dışından** gelen her şey plakayı tanımıyor | Butcher (duvarı kalınlaştırmak duvarı iyileştirmiyor), Screamer (kurulma içinde öldürülebilir kalmalı) |
  | **Wound Up** | Hasar aldıkça 2 saniye ×1.55 hızlanıyor | Sprinter (7.4 zaten 8.2'ye kıl payı), Clinger (yakalayanın hızlı olmasına gerek yok) |
  | **Swollen** | Öldüğü yerde patlıyor (Burster'ın patlaması) | Burster (zaten yapıyor) |
  | **Unburnt** | Fişek onu ne çekiyor ne yakıyor | — |

  **Tavan, oran değil:** sektör 3'ten önce hiç yok, sonra `min(3, 1+sektör/3)`.
  %20'lik bir oran 34 gövdede 7 elit demek olurdu — Hades'in tüm odasından
  fazla, ve katman "tuhaf olan" değil "yeni normal" diye okunmaya başlardı.
  İşaretli gövde sıra sıralamasında 2 m avans alıyor (sahnede olmayan işaret
  harcanmış işarettir), 2 hurda ve ×1.6 puan ödüyor. **Can bonusu yok** — fark
  kuralın kendisi. Her işaretin ilki bir kez toast'la tanıtılıyor, sonrası
  oyuncunun işi.
- **Kapan (Clinger).** Kalabalık oyununun eksik dişlisi: oyuncuyu bir saniye
  durdurmak, kalabalığın kendisini silaha çeviren tek şey. Sırası olan bir
  Clinger 3.6 m'ye girince 0.35 saniyelik bir hamleye giriyor — **hamle
  seçtiği hattı bırakmıyor**, yani yuvarlanan oyuncunun yanından geçip gidiyor.
  Tuttuğunda hareket ve yuvarlanma kilitleniyor; **nişan ve ateş serbest
  kalıyor**, çünkü silahı da alan bir tutuş karar değil, can barlı bir ara
  sahne olurdu. Saniyede 13 hasar (tam tutuş ≈ 20 can) — asıl bedel o 1.5
  saniyede sokağın geri kalanının üstüne gelmesi.
  **Üç çıkış yolu:** yuvarlanarak önlemek (bedava ama zamanlama), **F ile
  itmek** (anında ama 5 sn cooldown), ya da **hayvan** — strike yapabilen her
  hayvan üstünden alıyor. Kedi alamıyor, çünkü kedi hiç dövüşmüyor; bu
  bilinçli. Aynı anda yalnız bir tanesi tutabiliyor.
- **Spawn telegraph'ı.** Hiçbir şey aniden belirmez: yere 0.45 sn kanlı bir
  halka çizilir, sonra düşman oradan gelir. Spawn oyuncudan en az 12 m, en fazla
  33 m uzakta ve çitin içinde.
- **Spawn ritmi:** 0.85 sn'de bir 2'şer; ekranda 7'den az varsa 4'er (sokağın
  sessizleşmesini engelleyen "top-up"). Ekranda tavan 34 aktif düşman.
- **Ağırlıklı kuyruk:** nadir tipler (Butcher 0.45, Burster 0.6) düşük ağırlıkla
  çekilir ki dalganın sonunda tek blok hâlinde gelmesinler.

### BOSS: The Behemoth (her 5. sektör)

- 900 can (× gece zorluğu). İki faz.
- **Faz 1:** oyuncunun bulunduğu yere nişan alan slam. 0.95 sn telegraph (yerde
  yanık halka + kollar havaya kalkar), 8 m yarıçap, 38 hasar. 4.2 sn'de bir.
- **Faz 2 (%50 can):** renk değişir, kükrer. Slam 3.2 sn'ye iner, her slam'de
  3 sprinter çağırır, ayrıca 2.6 sn'de bir **9 yönlü safra halkası** atar.
- Ödül: 300 scrap × gece çarpanı + 5000 skor. Ardından "eve dön / daha derine
  in" kapısı açılır.

---

## 5. HAT: SEKTÖR VE DALGA HATTI

### Sektör tipleri (5'lik döngü)

| Sektör | Tip |
|---|---|
| 1, 2, 4 | Normal çatışma |
| 3 (ve 8, 13…) | **Vic'in köprü altı** — düşman yok, saf ticaret, nefes molası |
| 5 (ve 10, 15…) | **Boss** |
| %3 == 2 olanlar (2, 11, 14…) | Ek olarak **zincirli sandık** |

### Spawn eğrisi (Dusk / zorluk 0)

| Sektör | Shambler | Sprinter | Bloater | Butcher | Burster | **Toplam** |
|---|---|---|---|---|---|---|
| 1 | 13 | 0 | 0 | 0 | 0 | **13** |
| 2 | 17 | 3 | 1 | 0 | 0 | **21** |
| 3 | — trader — | | | | | **0** |
| 4 | 24 | 8 | 4 | 2 | 3 | **41** |
| 5 | 14 | 8 | 4 | 2 | 4 | **32 + Behemoth** |
| 6 | 30 | 13 | 7 | 4 | 6 | **60** |
| 7 | 34 | 16 | 8 | 5 | 8 | **71** |

**Niyet:** ilk iki sektör *bilerek* yumuşak — başlangıç karabinasıyla, hiç boon
almadan hayatta kalınabilmeli. Yeni tipler kademeli açılıyor: sprinter/bloater
sektör 2'de, butcher/burster sektör 3'ten sonra.

### Sektör temizlendi koşulu
Kuyrukta bekleyen 0 **ve** sahada aktif düşman 0 **ve** (boss sektörüyse) boss
ölü. Sonra iki kapı açılır, `state = CHOOSING_GATE`.

### Geçiş
0.62 sn siyah fade. Dünya **fade'in en karanlık anında** (0.31 sn) değişir —
oyuncu hiçbir zaman dünyanın pop-in yaptığını görmez. Oyuncu geçiş boyunca
dokunulmaz.

---

## 6. HAT: KAPI / ÖDÜL HATTI

Sektör sonunda **iki kapı** açılır. Her kapının üstüne el yazısıyla boyanmış bir
tabela çakılıdır ve **tabelada yazan şey, kapıdan geçince alınan şeyin ta
kendisidir** — aynı `GateOffer` nesnesi hem tabelayı boyar hem de ödülü öder.
Bu bir mimari karar: *işaret ile ödül asla birbirinden ayrılamaz.*

| Kapı | Tabela | Ödül |
|---|---|---|
| **RADIO CONTACT** | "Somebody is broadcasting down there" + o kişinin portresi | Yeni sektörde o kişiden 3 teklif |
| **SALVAGE YARD** | "+128 SCRAP" (gerçek sayı yazılı) | (45 + sektör×12) × gece çarpanı |
| **MEDICAL POST** | "+15 MAX · PATCH UP" | +15 maks can, 55 iyileşme |
| **ARMS CACHE** | "+12% DAMAGE" | ×1.12 hasar, ×0.9 ağır atış CD |
| **VIC'S UNDERPASS** | "GOODS FOR SCRAP" | Sonraki sektör Vic olur |
| **THE WAY BACK** | "BANK 640 SCRAP" (cebindeki gerçek sayı) | Sadece boss sonrası. Cebindekinin **tamamı** tezgâha yazılır, koşu biter |

**Dağılım:** %72 ihtimalle kapılardan biri **her zaman** bir RADIO CONTACT olur.
Boonlar build'in omurgası olduğu için nadir olmamalılar. TRADE kapısı ancak
sektör ≥4 ve %22 ihtimalle havuza girer, ayrıca Vic sektöründe hiç çıkmaz.

**Kimin telsizde olduğu kapıda belli.** Yani seçim kartlarda değil, **sokakta**
yapılıyor — Hades'te tanrının sembolü olan kapıdan girmek gibi. Kartlar sadece
o kişinin hangi iyiliğini alacağını belirliyor.

---

## 7. HAT: BOON HATTI — "THE SIGNAL"

Beş kişi hâlâ telsizde yayın yapıyor. Her biri **sadece kendi bildiği şekilde**
yardım ediyor. Aynı kişiden tekrar tekrar almak, koşuya kimlik kazandırıyor.

| Çağıran | Frekans | Uzmanlık | İmza rengi |
|---|---|---|---|
| **SARGE** | 121.5 — Guard Freq | Ham öldürücülük: atış hızı, hasar, ağır atış CD | Pas (#a8552b) |
| **DR. VASQUEZ** | 148.2 — CDC Relay | Enfeksiyonu tersine çevirme: patlayan cesetler, delme, lifesteal | Yosun (#6f8a3c) |
| **MAE** | 27.185 — CB Ch.19 | Silahın kendisi: mermi hızı, delme, toplama menzili | Kehribar (#c99a3c) |
| **PASTOR ELI** | 89.9 — Church FM | Hayatta kalma: maks can, hasar azaltma, ek kalkma | Kemik (#c6c2b0) |
| **UNKNOWN** | ??? — Carrier Only | Keskin takaslar: crit ve hız karşılığında maks can | Kan (#8e2323) |

**20 boon (kişi başı 4).** Örnekler:

- *Suppressing Fire* (Sarge): +%13k atış hızı
- *Viral Load* (Vasquez): kill'lerin %14k'sı patlar, etrafına hasar verir
- *Hardened Cores* (Mae): mermiler (1+k) gövde daha deler
- *Not Finished Yet* (Eli): bir kez daha ayağa kalk
- *Run Light* (Unknown): +%13k hız, **−10 maks can**
- *Nothing Personal* (Unknown): +%14k hasar, **−8 maks can**

### Kademe (tier) sistemi

| Kademe | Çarpan (k) |
|---|---|
| SALVAGED | 1.00 |
| SOLID | 1.35 |
| PRIME | 1.80 |
| RELIC | 2.40 |

Kademe olasılığı sektör derinliğiyle kayar (`bias = min(0.3, sektör × 0.03)`).

**Kritik detay:** kart üzerindeki metin, uygulanan formülün *aynısından*
üretiliyor (`describe(k)` ve `apply(p, k)` aynı katsayıyı okur). Kart asla
yalan söyleyemez. Bu, boon sistemlerinde en sık yapılan hatanın önüne geçen
küçük ama önemli bir mühendislik kararı.

### Çağıran rotasyonu
Son 2 çağıran havuzdan çıkarılır — bir koşuda beş sesi de duyarsın, iki
kişi monopol kuramaz. Oyuncunun en çok kullandığı kişi (2+ boon) %40 ihtimalle
öne çekilir: "tema" oluşturmak isteyene yardım eder ama garanti vermez.

---

## 8. HAT: META İLERLEME HATTI (Mirror of Night)

Tezgâhta (Workbench), scrap ile satın alınır, **kalıcıdır**.

| Yükseltme | Etki / rank | Maks rank | Toplam maliyet |
|---|---|---|---|
| Scrap Plating | +12 maks can | 5 | 350 |
| Broken-In Boots | +0.55 hız | 4 | 290 |
| Scavenger's Eye | +%15 scrap | 4 | 340 |
| Steady Hands | +%7 atış hızı | 4 | 360 |
| Sharp Eye | +%5 crit | 4 | 360 |
| Deep Pockets | +1.6 m toplama | 3 | 150 |
| Field Medic | Bandaj +%40, daha sık düşer | 3 | 255 |
| **Second Wind** | +1 ayağa kalkma | 2 | 580 |

**Tasarım kuralı:** rank başına artış bilerek küçük. Amaç "kötü bir koşu bile
iğneyi oynatsın", "rank 5 oyunu trivialize etsin" değil.

### Tam açılım maliyeti

| Kalem | Scrap |
|---|---|
| 8 meta yükseltme (tam) | 2.685 |
| 4 silah kilidi | 1.230 |
| 5 field mod | 1.420 |
| **TOPLAM** | **5.335** |

---

## 9. HAT: ZORLUK HATTI — "THE LONG NIGHT" (Pact of Punishment)

Radyo setinden seçilir. Gönüllü zorluk; **tek mantıklı sebebi ödemesinin daha
iyi olması.**

| Kademe | Ad | Düşman canı | Hızı | Sayısı | Scrap çarpanı |
|---|---|---|---|---|---|
| 0 | Dusk | ×1.00 | ×1.00 | ×1.00 | ×1.0 |
| 1 | Nightfall | ×1.20 | ×1.06 | ×1.15 | ×1.3 |
| 2 | Dead Hours | ×1.45 | ×1.12 | ×1.35 | ×1.7 |
| 3 | Long Night | ×1.80 | ×1.20 | ×1.60 | ×2.2 |
| 4 | Last Light | ×2.30 | ×1.30 | ×1.90 | ×3.0 |

Her kademenin bir de dünya cümlesi var ("Something is driving them toward
you.") — zorluk seçimi bile kurgunun içinden konuşuyor.

---

## 10. HAT: EKONOMİ HATTI

### Cep ve tezgâh — scrap iki yerde durur

Sokakta toplanan hiçbir şey anında kalıcı kayda yazılmaz. **Cep** (`runScrap`)
gecenin tamamı boyunca oyuncunun üstünde durur; **tezgâh** (`SaveSystem.scrap`)
yalnızca koşu bittiğinde, kapıda bir kez yazılır:

| Koşu nasıl bitti | Tezgâha giden |
|---|---|
| THE WAY BACK'ten yürüyerek | cebin **%100**'ü |
| Ölüm (veya duraklatma menüsünden dönme) | cebin **%40**'ı — gerisi sokakta kalır |

Oran tek bir yerde: `SCRAP_KEPT_ON_DEATH` (`src/config/Progression.ts`), ayrımı
yapan da tek bir fonksiyon: `settleRun()`. Bu sayı 1'den küçük olduğu için
Behemoth'tan sonraki kapı gerçek bir karar: cebinde 640 varken daha derine
inmek 384 scrap'i masaya koymak demek.

**Vic de cepten ödenir**, tezgâhtan değil. Yani kalıcı birikimi olan bir oyuncu
Vic'in tezgâhını her koşu bedavaya süpüremiyor; ne aldıysan bu gece
topladığınla alıyorsun.

**HUD'daki plaka iki farklı sayıdır ve hangisi olduğunu yazar:** sokakta
"CARRYING" (kaybedilebilir), sığınakta "BANKED" (kaybedilemez).

### Scrap kaynakları
- Düşman ölümü: 1–4 parça × Scavenger (1 + 0.15×rank) × gece çarpanı
- SALVAGE YARD kapısı: (45 + sektör×12) × gece çarpanı
- Zincirli sandık: 120 × gece çarpanı + bandaj
- Behemoth ganimeti: 300 × gece çarpanı

### Scrap harcamaları
- Silah kilidi (150–480), field mod (220–360), meta rank (30–400), Vic'in malları (28–70)

### Vic'in kataloğu (koşu-içi, tek seferlik)

| Mal | Etki | Fiyat |
|---|---|---|
| Field Dressing | 65 can | 28 |
| Boot Grease | +%9 hız | 48 |
| Somebody's Saint Medal | +%6 crit, +%3 hasar azaltma | 55 |
| Hand-Loaded Rounds | +%14 hasar | 62 |
| Truck Door Plate | +25 maks can (dolu) | 70 |

Vic her sektörde 3 tanesini seriyor. Konuşmuyor, pazarlık etmiyor, scrap'in
nereden geldiğini sormuyor. Gaz maskesi kaynaklı — kimse yüzünü görmedi.
**Bu oyunun Charon'u.**

---

## 11. HAT: BASKI VE RİSK SİSTEMLERİ

Bunlar oyuncunun "iyi oynamak" ile "hayatta kalmak" arasında karar verdiği
yerler.

### Zincirli sandık (opsiyonel risk)
Kilidi kır → **18 saniyede 12 kill** kotası başlar, üstelik gürültü **anında 6
ek düşman çağırır.** Başarırsan 120 scrap + bandaj. Başaramazsan sandık kapalı
kalır ve sokağı bedavaya kötüleştirmiş olursun. Oyunun "gönüllü tehlike" beat'i.

### Yol fişeği (Q — ultimate)
Adrenalin dolunca (≈19 kill) atılır. **20 metreden sürüyü kendine çeker**,
0.25 sn'de bir (16 + sektör×2) hasar yakar, 5 saniye sonra 12 m yarıçapta
(260 + sektör×30) hasarla patlar — yani sektör 1'de 18/290, sektör 10'da 36/560.
**Takas bilinçli:** kalabalığı önce daha kötü hâle getirip sonra çözüyor.
Yerleştirme becerisi isteyen tek yetenek.

### Dolum (R)
Her silahın şarjörü var (2–45) ve tetik başına bir mermi gidiyor. Şarjör
biterse silah **kendi kendine** doldurmaya başlıyor — yani boşta tık tık
etmek diye bir durum yok, ama dolumun ne zaman başlayacağına karışmamış
oluyorsun. R ile erken doldurmak bu yüzden bir karar: sokak sakinken 2
saniyeyi vermek mi, yoksa dolu olmayan bir şarjörle bir sonraki dalgaya
girmek mi. HUD'daki tek bar iki işi birden yapıyor: kalan mermi, sonra
dolum ilerlemesi (kehribar renginde).

### İtekleme (F)
5.5 m, 5 sn cooldown. Önündekiler 26 kuvvetle uçar ve 1.4 sn sersemler;
arkandakiler 10 kuvvetle itilir, 0.6 sn sersemler. **Yön önemli** — panikle
basmak yerine dönüp basmak ödüllendiriliyor. Kuşatıldığında tek çıkış kartı.

### Yuvarlanma (SPACE)
0.24 sn tam dokunulmazlık. Stamina 34, rejen 38/sn → **yaklaşık 0.9 saniyede
bir**. Sprinter hızı 7.4, oyuncu 8.2 — yani kaçış yürüyerek zar zor mümkün,
yuvarlanma bunu güvenli hâle getiriyor.

### Get up (ikinci nefes)
Ölümcül hasar aldığında, hakkın varsa: %45 canla ayağa kalkarsın, 2.2 sn
dokunulmazlık, ekranda "BACK ON YOUR FEET — That was the last one you get for
free." Bir koşuda 1 (meta ile 3, boon ile daha fazla) hakkın var.

---

## 12. HAT: SIĞINAK / HUB HATTI

Hırdavatçının altındaki, tahtalarla kapatılmış bir bodrum. Düşman yok, parlayan
hiçbir şey yok. 6 istasyon:

| İstasyon | İşlev |
|---|---|
| **Weapon Rack** | Bu gece hangi silahı taşıyacağını seç, kilit aç, mod tak/çıkar |
| **Workbench** | Kalıcı yükseltmeler (Mirror of Night) |
| **Radio Set** | Long Night kademesi seç |
| **Pin Board** | Kayıtlar: koşu sayısı, ölüm, en derin sektör, toplam kill, en iyi skor |
| **The Pens** | Bu gece hangi hayvan seninle geliyor; yenilerini besleyip sahiplen |
| **Cellar Stairs** | Dışarı çık — koşu başlar |
| **Rook (köpek)** | Menü değil. Sevebilirsin; sevmek onu "bu gece gelen" yapar |

**Rook** oyunun duygusal çapası: yatağı sobanın yanında, kendi mizacı var
(`STAY` / `FOLLOW` / `GREET`), sen merdivenden indiğinde seni karşılamaya
geliyor, sonra yatağına dönüyor. Artık dışarıda da bir işi var — ama onu
sevmenin bedeli yok, ve listeyi açmadan da yapılabiliyor.

### The Pens — yanına ne alıyorsun (7 hayvan)

Silah rafının hayvan hâli: **biri seninle gelir, geri kalanı kalır.** Farkı,
"nobody" seçeneğinin de bir buton olması — ve hiçbirinin ölmemesi.

| Hayvan | Rol | Fiyat | Ne yapar |
|---|---|---|---|
| **Rook** — lurcher | Harries | 0 | En yakındakini kovalar; 16 hasar + sendeletme |
| **Mouser** — kedi | Keeps you steady | 120 | Hiç dövüşmez; 4 sn darbe yemediysen sn'de 2 can |
| **Sixpence** — saksağan | Lifts scrap | 190 | 16 m'ye kadar yerdeki hurdayı alıp eline getirir |
| **Nan** — keçi | Pulls the street | 250 | 11 m yarıçapındaki ölüler sana değil **ona** yürür |
| **Kite** — şahin | Stoops | 340 | En uzaktakine dalış; 40 hasar, yerdeki hiçbir şey ona değemez |
| **Bristle** — yaban domuzu | Runs a line | 420 | 7 sn'de bir hat seçip koşar; 45 hasar, üçüncü gövdede durur |
| **Honey** — ayı | Puts them down | 560 | 6 sn'de bir 4 m yarıçapında 75 hasar + yere serme |

**Tasarım kuralları:**

1. **İkinci bir silah değiller.** Hepsinin ham hasarı oyuncunun silahının onda
   biri civarında. Sattıkları şey oyuncuda olmayan bir **fiil**: sendeleten
   biri, kalabalığı üstünden alan biri, sen dövüşürken yoldan hurda toplayan
   biri. Ölçüm (4. sektör, 30 sn, oyuncu ateş etmiyor): Rook 3, Kite 4,
   Bristle 14, Honey 17 öldürme. Sıralama fiyat sıralamasıyla aynı.
2. **Hiçbiri ölmüyor.** Ölülerle yeterince temas ederse yolda yere yığılıyor;
   sokak temizlendiği anda kalkıyor. Kalıcı ölüm, her şeyini kaybetmeye dair
   bir oyunda kimsenin istemediği tek zulüm olurdu — üstelik mekanik olarak da
   her hayvanı "evde bırakılan şey"e çevirirdi.
3. **Sığınakta görünüyorlar.** Seçilen hayvan yükleme kapağının olduğu köşedeki
   ağılda duruyor; oyuncu satın aldığı şeyin yanından geçebiliyor. Rook'un
   istisnası: odanın kendi köpeği, ağılı hiç kullanmıyor.
4. **Sana geleni hedef alıyorlar.** Ölüler sırayla geldiği için (§4) "en yakın
   ceset" artık "senin derdin olan ceset" demek değil — bekleme halkası
   hayvanla senin aranda duruyor. Hedef seçiminde saldırı sırası olan cesede
   5 metrelik bir avans veriliyor: filtre değil, ağırlık — kimse saldırmıyorsa
   seçim yine düz "en yakın". Ölçüldü (30 sn, 16 gövde, 3 sıra, aynı tohum):
   Rook'un ısırıklarının gerçekten saldıran birine gitme oranı %28 → %92,
   oyuncudan 6 m'den uzakta geçirdiği süre %62 → %10. **Bedeli var:** artık
   kavganın içinde durduğu için daha hızlı yıpranıyor (30 saniye sonra kalan
   kondisyon %60 → %23). Hayvan işini yapıyor, ve işini yapmak yıpratıyor.

**Odanın iki duvarı yok.** Kamera güneydoğu köşesinden bakıyor; doğu ve güney
duvarları kamerayla zemin arasında kalacağı için **hiç inşa edilmemiş.** Sınır
betonla değil kodla uygulanıyor, açık kenarlarda alçak bir subasman var ki
zemin "kopmuş" değil "duvarda bitiyor" gibi okunsun. Sabit kameralı izometrik
oyunların gerçekte kullandığı çözüm bu.

---

## 13. HAT: ANLATI VE KARAKTER HATTI

Diyalog yok, cutscene yok, günlük toplama yok. Anlatı **üç kanaldan** akıyor:

1. **Sektör isimleri ve tag-line'ları** — "Willow Creek: Suburban cul-de-sac.
   Doors still open, cars still in the drives." / "Downtown Cordon: The army
   made their stand here. You can see how that went."
2. **Telsizdeki beş ses** — her birinin imza cümlesi, frekansı, portresi ve
   sembolü var. Bir emekli çavuş, bir epidemiyolog, genç bir tamirci, yaşlı bir
   papaz, ve **sadece taşıyıcı dalga olan altıncı bir sinyal.**
3. **Arayüz metni** — banner'lar dünyanın içinden konuşur: "THE LOCK GIVES —
   And every dead thing on this street heard it."

**Oyuncu asla isimlendirilmiyor, konuşmuyor, yüzü tam gösterilmiyor.** Kapüşonun
altındaki kişi hâlâ yürüyen herhangi biri olabilir; olay bu.

**UNKNOWN** hakkında hiçbir zaman cevap verilmiyor ve tasarım gereği asla da
verilmemeli. Kapüşonun içi siyah, iki donuk kırmızı yarık, altta kesilen bir
taşıyıcı dalga. Sunduğu her boon bir bedel içeriyor.

*(`docs/character-briefs.md` — beş karakter + oyuncu için, illüstratöre
verilebilecek düzeyde tam sanat brief'i mevcut: siluet, ışık, palet, sembol.)*

---

## 14. HAT: KAMERA VE GÖRSEL HAT

### Kamera: dimetrik ortografik
- **Ortografik projeksiyon.** Hiçbir şey uzakta küçülmüyor — kadrajın tepesindeki
  sprinter, yanına gelmek üzere olanla **aynı boyutta.** Bir düzine düşman
  sahaya yayıldığında arenanın okunabilir kalmasının sebebi bu.
- **Pitch 33°, Yaw 45°** (sığınakta 38°). 35.26° gerçek izometrik açı, 30° temiz
  2:1 basamak; bu bant dışına çıkınca oyun top-down twin-stick'e dönüşüyor.
- Kadraj yükseklik cinsinden tanımlı (28 birim): pencere şekli ne olursa olsun
  **her zaman aynı metre sayısını** görürsün.
- Girdi ekran uzayında okunup kamera yaw'ına döndürülüyor — "yukarı" her zaman
  kameradan uzağa yürümek.

### Okunabilirlik çözümleri (bunlar gerçek problemlerin çözümleri)
- **Occlusion siluet:** 33°'lik yatık açıda ölü bir ağaç arkasındaki 11 birimlik
  alanı kapatıyor. Oyuncunun önünde 2.2 m'den yüksek bir prop varsa, karakterin
  üstüne derinlik testi kapalı, %30 opaklıkta soluk bir kapsül siluet çiziliyor.
  Sadece gerçekten kapatıldığında açılıyor ve canlı kamera yerine rig açısına
  göre hesaplanıyor ki sarsıntıda titremesin.
- **Sis telafisi:** sis yoğunlukları eski dik kameraya göre yazılmıştı (39 birim
  görüş); izometrik rake 55 birim görüyor ve FogExp2 mesafenin karesini alıyor.
  Sabit bir `39/55` ölçekle tablolara dokunmadan düzeltildi — sektörlerin
  birbirine göre okunuşu korunuyor.
- **Güneş ters omuzda:** kamera güneydoğudan bakıyorsa, güneş de oradan gelirse
  bütün gölgeler nesnenin arkasına düşer ve görünmez. Güneş karşı tarafa
  alındı; gölgeler ekranda aşağı-sola düşüyor — ortografik projeksiyonun
  vermediği temas noktası ipucunu veren şey bu.
- **Gölge frustum'u oyuncuyu takip ediyor**, tam birime yuvarlanarak (texel
  yüzmesin diye). 2048 harita, ~46 birim yarım genişlik.

### Palet ve post-process
- Tek sıcak vurgu ailesi: pas / kehribar / kan. Geri kalan her şey desatüre
  yeşil-gri-toprak.
- ACES filmik tone mapping, exposure 1.12.
- **Bloom bilerek çok düşük** (0.16). Sadece namlu alevi ve ateş "sıcak"
  okunsun diye. Daha fazlası her şeyi tekrar neona çeviriyor.
- Flat shading her yerde; düşük poligonlu, fasetli, "elde yontulmuş" bir dil.

### Sanat üretimi
**Hiç dış görsel asset yok.** Karakterler ve dünya three.js primitifleriyle
prosedürel; portreler, semboller ve silah çizimleri **kod içi SVG** (kâğıt
grenli, tek sert gölge, sıcak rim ışığı — Hades'in boyalı key art dili).

---

## 15. HAT: UI / UX HATTI

- **HUD:** sağlık / stamina / adrenalin barları, get-up sayacı, scrap, kill,
  sektör adı + hedef, silah adı, **şarjör sayacı ve dolum barı**, ağır atış ve
  shove cooldown'ları, gece etiketi.
- **Minimap:** kamera yaw'ına döndürülmüş (dünya ile minimap asla ayrışmaz),
  düşmanlar, kapılar, boss.
- **Hasar sayıları:** dünyadan ekrana yansıtılan, crit'te farklı renk.
- **Banner'lar:** sektör girişi, sokak temizlendi, boss girişi, sandık kilidi.
- **Toast'lar:** her ödül ve satın alma için tek satır teyit.
- **Prompt sistemi:** yaklaşınca "Chained Crate — Break the lock: 12 kills in
  18s" gibi bağlamsal E-tuşu ipucu.
- **Codex / Koşu Kâğıdı (TAB):** taşınan sinyallerin tamamı (ad, çağıran,
  kademe ve etkisinin kartla aynı metni), koşu istatistikleri, ve **"Half of
  Something"** bölümü: bir ebeveynini taşıdığın bağlı sinyaller, neyin eksik
  olduğuyla birlikte — iki ebeveyni de tamamsa `READY` etiketiyle. Bağlı
  sinyalleri kazayla değil bilerek bulunabilir yapan şey bu bölüm.
- **Loading ekranları:** sektör adıyla, 0.7–0.9 sn — dünya değişimini gizleyen
  ve nefes aldıran perde.
- **Kapı tabelaları:** her ödül tipi için ayrı el-boyaması amblem ve renk.
- **Menüler:** kâğıt/pano estetiği; silah rafında bar-grafik readout (power /
  speed / reach / control) + mermi/saniye gibi ham sayı.

---

## 16. HAT: SES HATTI

**Tamamen prosedürel WebAudio — tek bir ses dosyası yok.**
- Silah sesleri 4 karakterde sentezlenir (light / medium / heavy / nail):
  gürültü patlaması + filtre zarfı + thump.
- Ayrı olaylar: impact, dodge, shove, get-up, flare, swell (burster şişerken),
  boss roar, slam, scrap, gate open, sector clear, purchase, error, pickup.
- Arka planda düşük frekanslı, iki osilatörlü, filtrelenmiş bir uğultu — müzik
  değil, basınç.
- M tuşuyla susturma; sekmeye odak kaybında girdi serbest bırakılır.

**Açık eksik:** bu bir prototip ses hattı. Gerçek foley ve adaptif müzik
gerekiyor. (Bkz. §18.)

---

## 17. HAT: TEKNİK HAT

| Konu | Karar |
|---|---|
| Stack | TypeScript (strict) + three.js r185 + Vite 8 |
| Boyut | ~10.700 satır, 44 modül, 2 runtime bağımlılığı (three, simplex-noise) |
| Nesne havuzları | Düşman 180/320, mermi 260/460, ganimet 140/260, fişek 3/6 — koşu ortasında hiç allocation yok |
| Uzamsal indeks | 6 birim hücreli spatial hash grid; çarpışma ve separation sorguları O(n²) değil |
| Draw call | Zombi gövdesi tek merged geometry'ye indirildi (vertex color ile) — 8 mesh × 30 zombi = ~300 çağrıdan ~60'a. Prop'lar, mermiler ve ganimetler instanced |
| Frame bütçesi | Separation 3 karede bir; delta 33 ms'e clamp'li (sekme değişimi nesneleri duvardan geçirmesin) |
| Hata dayanıklılığı | Update ve render ayrı try/catch içinde — bir hata oyunu düşürmüyor, konsola düşüyor |
| Kayıt | localStorage, şema doğrulamalı, bozuk kayıtta temiz başlangıç, eski sürümden migration mevcut |
| Debug | `window.__engine` üzerinden `debugState()` / `debugTeleport()` (yalnızca dev) |

---

## 18. HADES KARŞILIĞI TABLOSU

| Hades | LAST LIGHT | Farkı |
|---|---|---|
| Olympos tanrıları | Telsizdeki 5 sivil | Tanrı değil; kendi hayatta kalma mücadelesindeki insanlar |
| Boon kapısı sembolü | Kapıya çakılmış el-boyaması tabela + portre | Aynı sözleşme: seçim odada değil kapıda |
| Infernal Arms (6) | 5 ateşli silah | Aynı: koşu başına bir tane |
| Aspects (silah başı 4) | Field mod (silah başı **1**) | **Belirgin şekilde daha sığ** — bkz. §19 |
| Mirror of Night | Workbench (8 yükseltme) | Aynı işlev, daha az kalem |
| Darkness | Scrap | Tek para birimi (Hades'te 6+ var) |
| Charon | Vic | Aynı: konuşmaz, sadece satar |
| Pact of Punishment | The Long Night (5 kademe) | Basitleştirilmiş: 4 eksen, 12 pakt değil |
| Chamber → kapı seçimi | Sektör → kapı seçimi | Birebir |
| Boss (Megaera vb.) | The Behemoth | Şu an **tek** boss — bkz. §19 |
| Keepsakes / Duo boons | **Yok** | En büyük eksik |
| Companions | The Pens (7 hayvan) | Hades'te yok — buradaki karşılığı kalıcı satın alma, koşu başına bir tane |
| Anlatı ilerleyişi | **Yok** | İkinci en büyük eksik |

---

## 19. DÜRÜST DEĞERLENDİRME — BOŞLUKLAR VE RİSKLER

*Bir designer bunları zaten soracak; önce biz söylersek konuşma daha verimli
olur.*

### Tasarım riskleri

1. ~~**Ölümün bedeli neredeyse yok.**~~ **Kapandı** (§10, "Cep ve tezgâh").
   Scrap artık toplandığı anda değil, kapıda yazılıyor; ölünce %60'ı sokakta
   kalıyor. Boonların kaybına ölçülebilir bir kayıp eşlik ediyor ve "eve dön"
   kapısı gerçekten bir şey kurtarıyor. **Açık kalan:** %40 oranı ölçülmedi —
   playtest verisi olmadan seçilmiş bir sayı. Çok cömertse derinlik baskısı
   zayıf kalır, çok sertse oyuncu boss'tan sonra hiç derine inmez.
2. **Boon havuzu sığ.** *Kısmen kapandı.* Üç yapısal değişiklik yapıldı:
   (a) koşu artık ne taşıdığını hatırlıyor, (b) aynı boon iki kez teklif
   edilmiyor — her çağıranın dördü sonlu bir set, (c) **bağlı sinyaller
   (bonded)** eklendi: iki belirli boon elde varken açılan, sayı değil *kural*
   değiştiren bir kart sınıfı. Altyapı hazır ve bir tanesi yazılı (*Through And
   Through* — mermi her deldiği gövdeden %35 daha sert çıkıyor; ölçüldü:
   24 → 32 → 43 → 58).

   **Açık kalan:** şu an tek bir bağlı sinyal var. Hades'teki derinliği vermek
   için 6-8 tane gerekiyor ve her biri gerçek bir mekanik demek, çarpan değil.
3. **Tek boss.** 5, 10, 15. sektörlerde aynı Behemoth. Uzun koşu tekrara giriyor.
4. **Field mod silah başına bir tane.** Aspect sisteminin verdiği "aynı silahı
   yeniden keşfetme" duygusu yarım kalıyor.
5. **Bankaya yazma sadece 5 sektörde bir.** Boss'tan hemen sonra ölürsen 5
   sektörlük çabanın hiçbir kapanışı olmuyor — ve artık cebindekinin %60'ı da
   gidiyor. Ölüm bedeli eklendikten sonra bu madde **daha keskin** hâle geldi:
   çıkış noktalarının seyrekliği tek başına bir tasarım sorusu.
6. **Sektörler kozmetik olarak farklı, mekanik olarak aynı.** Beş bölge farklı
   ışık ve isim taşıyor ama arena şekli ve hedef aynı. Bölgeye özel bir kural
   (ör. hastanede görüş kısıtlı, kordonda mayınlı bölge) yok.

   *Prop dağılımı artık her sektörde yeniden atılıyor* — eskiden açılışta bir
   kez atılıp bütün oturum boyunca donuyordu, yani aynı on dört enkaz aynı on
   dört yerdeydi. Bu, sektörleri birbirinden ayırmanın ilk katmanıydı; ikinci
   katman (bölgeye özel prop karışımı) ve üçüncüsü (arena şekli — metro gibi)
   henüz yok.
7. **AI derinliği düşük.** Steering + separation + bir kiting davranışı. Kuşatma,
   flanking, sesle çekilme gibi sürü davranışları yok. Bloater dışında taktik
   çeşitliliği düşük.
8. **Adrenalin sadece fişek besliyor.** Tek ultimate; silaha göre değişmiyor.

### Üretim eksikleri
- Gerçek ses tasarımı ve adaptif müzik (şu an tamamen sentez prototip).
- Gamepad desteği yok. Erişilebilirlik seçenekleri (renk körlüğü, sarsıntı
  kapatma, metin ölçeği) yok.
- Telemetri / analytics yok — **bu yüzden sunumdaki süre tahminlerinin hiçbiri
  ölçülmüş değil.** Sektör başına ortalama süre, ölüm noktaları, silah kullanım
  dağılımı bilinmiyor. Playtest'ten önce eklenmesi gereken ilk şey bu.
- Tutorial / onboarding yok; kontroller sadece başlık ekranında yazıyor.
- Lokalizasyon altyapısı yok (metinler kodun içinde gömülü).

### İyi çalıştığına inandığımız şeyler
- **Kapı = ödül sözleşmesi.** Tabeladaki sayı ile ödenen sayı aynı nesneden
  geliyor; oyuncu hiçbir zaman aldatılmış hissetmiyor.
- **Boon kartı asla yalan söylemiyor** (metin ve etki aynı katsayıdan üretiliyor).
- **Ton disiplini.** "Hiçbir şey isteyerek parlamaz" kuralı tek satır kod
  seviyesine kadar uygulanmış (bloom 0.16, düşman göz çukuru siyah, telegraph
  yerde yanık halka — hologram değil).
- **Okunabilirlik.** Ortografik kamera + occlusion siluet + gölge yönü, tür
  için doğru problem setinin çözüldüğünü gösteriyor.
- **Silah kimlikleri.** Beş silah birbirine yakın DPS'te ama tamamen farklı
  mesafe/ritim profillerinde.

---

## 20. YOL HARİTASI ÖNERİSİ (öncelik sırasıyla)

| # | İş | Neden |
|---|---|---|
| 1 | Telemetri + 10 kişilik playtest | Bundan sonraki her karar veri istiyor |
| 2 | ~~Ölüm bedeli~~ — yapıldı; kalan iş %40 oranını playtest'le ayarlamak | Koşunun gerilimi buna bağlı |
| 3 | ~~Boonların birbirine dokunması~~ — altyapı ve ilk bağlı sinyal yapıldı; kalan iş 5-7 tane daha | Build derinliğinde en yüksek getiri |
| 4 | 2. ve 3. boss | Uzun koşu tekrarını kırar |
| 5 | Silah başına 2. field mod | Yeniden oynanabilirlik |
| 6 | Bölgeye özel mekanik kural | Sektörleri kozmetikten çıkarır |
| 7 | Gerçek ses + adaptif müzik | Tonun yarısı burada |
| 8 | Gamepad + erişilebilirlik | Kapsam |

---

## 21. DEMO SENARYOSU (masada 8–10 dakika)

1. **Başlık ekranı — 20 sn.** Portre, ton, "A roguelite of the long walk home".
2. **Sığınak — 90 sn.** Odayı gezdir, iki duvarın neden olmadığını söyle,
   Rook'u sev, silah rafını aç (bar readout + mod), radyodan Long Night'ı göster.
3. **Sektör 1 — 90 sn.** Temiz bir çatışma. Yuvarlanma, itekleme, hit-stop.
   Spawn telegraph'ını göster.
4. **Kapı seçimi — 60 sn.** İki tabelayı oku. "Tabeladaki sayı ile ödenen sayı
   aynı nesne" cümlesini burada söyle.
5. **Boon ekranı — 60 sn.** Portre plakası, üç teklif, kademe. Aynı kişiden
   ikinci kez alıp temayı göster.
6. **Sektör 2 + zincirli sandık — 2 dk.** Kilidi kır, 6 ek düşmanın gelişini ve
   kotayı göster. Bu, oyunun en iyi tek beat'i.
7. **Fişek — 30 sn.** Sürüyü çek, patlamayı göster.
8. **Sektör 3 / Vic — 45 sn.** Nefes molası ritmini anlat.
9. **Kapat:** §19'daki dürüst boşluk listesini aç ve soruları sor.

---

## 22. DESIGNER'A SORULACAK SORULAR

1. Ölüm bedeli olmayan bir roguelite'ta gerilimi neyle kurarsın — kaynak kaybı
   mı, ilerleme kaybı mı, yoksa tamamen zaman/skor baskısı mı?
2. 20 boon'luk bir havuzda derinliği artırmanın en ucuz yolu: daha çok boon mu,
   yoksa mevcut 20'yi birbirine bağlamak (duo/upgrade) mı?
3. "Eve dön" kapısını sadece boss sonrası tutmak doğru mu, yoksa her sektörde
   giderek kötüleşen bir çıkış oranıyla mı sunulmalı?
4. Sprinter hızı (7.4) oyuncu hızının (8.2) %90'ı. Bu marj doğru mu, yoksa kaçış
   tamamen yuvarlanmaya mı bağlanmalı?
5. Sektörleri mekanik olarak ayırmak için bölge kuralı mı yoksa bölgeye özel
   düşman tipi mi daha iyi yatırım?
6. Ortografik/dimetrik kamera bu tür için doğru seçim mi — yoksa okunabilirlik
   avantajı, kaybedilen "yaklaşan tehdit büyür" bilgisine değmiyor mu?
7. Rook (köpek) gibi tamamen mekaniksiz bir öğeye yatırım yapmaya devam etmeli
   miyiz?
8. İlk 10 dakikada oyuncunun öğrenmesi gereken kaç sistem var, kaç tanesi fazla?

---

## EK: HIZLI SAYI KARTI

```
Oyuncu:      100 can (maks 160) · 8.2 hız (maks 10.4) · 0.85 yarıçap
             yuvarlanma 0.24 sn i-frame / 34 stamina / 38 rejen
             base crit %5 (maks %25 meta ile) · crit çarpanı ×2
Arena:       52 birim yarıçaplı daire (köşeye saklanmayı engellemek için)
Spawn:       oyuncudan 17–33 m, min 12 m ayrık, 0.45 sn telegraph
             0.85 sn'de 2 / ekranda <7 ise 4 · tavan 34 aktif
İşaretli:    sektör 3'ten önce yok · tavan min(3, 1+sektör/3)
             spawn'da %35 şans (tavan doluysa 0) · +2 hurda · ×1.6 puan
             Vested plaka 9 · Wound Up ×1.55 / 2 sn
Kapan:       55 can · 1.9 m menzil · 0.35 sn hamle · 1.5 sn tutuş
             sn'de 13 hasar · 6 sn bekleme · aynı anda tek tutuş
Çığlıkçı:    25 can · 15 m duruş · 1.2 sn kurulma · 9 sn bekleme
             çığlık: +6 gövde anında, 5 sn boyunca +6 sıra
Gürültü:     eşik 120 · unutma 2.5/sn · Ranger 8.7/sn, Stutter 10.3/sn
             Boomstick 3.5/sn, Widowmaker 2.4/sn, Harvester 0.3/sn
Sıra:        aynı anda 3 + sektör×0.7 saldırgan (tavan 9)
             sıra 6.5 sn · dinlenme 3.5 sn · dağıtım 0.45 sn'de bir
             bekleyen halka 7.5–13 m · yay 3 m'de kapanıyor
Şarjör:      Ranger 30/2.1 · Boomstick 2/1.2 · Widowmaker 5/2.5
             Stutter 45/1.8 · Harvester 24/2.2 (mermi / saniye)
Kapılar:     %72 en az bir SIGNAL · kapı A (−17,−19), kapı B (+17,−19)
Geçiş:       0.62 sn fade, dünya 0.31 sn'de değişir
Boss:        900 can · faz 2 %50'de · slam 4.2→3.2 sn · 8 m / 38 hasar
Fişek:       20 m çekim · tick (16+sek×2) · 5 sn sonra 12 m / (260+sek×30)
Sandık:      18 sn'de 12 kill · +6 anlık düşman · 120 scrap
Ölüm:        cebin %40'ı tezgâha yazılır, %60'ı sokakta kalır
Dönüş:       cebin %100'ü
Tam açılım:  5.335 scrap
```
