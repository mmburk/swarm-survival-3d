# LAST LIGHT — Ses Planı

*Mevcut ses hattının tam dökümü ve nereye gideceği. Sayılar koddan alındı;
tahmin olan yerler "tahmin" diye işaretlendi.*

Ton kuralının ses karşılığı, ışık kuralının aynısıdır:
**bu dünyada hiçbir şey sinematik değil.** Riser yok, braam yok, whoosh yok,
"epik" vurgu yok. Ses ya bir alet, ya bir gövde, ya bir oda.

---

## 0. ŞU ANDA NE VAR

`src/core/AudioManager.ts` — 656 satır, tek dosya, tek dış bağımlılık yok.
Tamamı WebAudio ile sentezleniyor; projede **tek bir ses dosyası yok.**

### Çalışan çekirdek

İki ilkel üstüne kurulmuş, ikisi de doğru fikir:

| İlkel | Ne yapıyor |
|---|---|
| `noiseBurst()` | Paylaşılan gürültü tamponundan biçimlendirilmiş bir patlama — filtre tipi, başlangıç/bitiş frekansı, Q, süre, gecikme |
| `thump()` | Altına binen alçak sinüs — atışa ağırlığını veren şey |

Üstüne 17 canlı olay: `playGunshot` (4 karakter), `playImpact`, `playDodge`,
`playShove`, `playReload`, `playReloadDone`, `playDryFire`, `playGetUp`,
`playFlare`, `playSwell`, `playBossRoar`, `playSlam`, `playScrap`,
`playGateOpen`, `playSectorClear`, `playPurchase`, `playError`, `playPickup`,
`playExplosion`, `playPlayerHurt`.

Arka planda iki osilatörlü bir uğultu: 90 Hz sinüs + 45 Hz üçgen → 250 Hz
alçak geçiren → gain 0.06. Müzik değil, basınç.

### Ölçülen eksikler

| Bulgu | Sayı |
|---|---|
| Dosyadaki ölü metot (sci-fi döneminden, **sıfır çağrı yeri**) | 10 metot, ~460 satır |
| `Math.random` — yani atıştan atışa varyasyon | **2** (656 satırda) |
| `StereoPannerNode` / `PannerNode` — yani konum bilgisi | **0** |
| `ConvolverNode` — yani mekân | **0** |
| Yazılmış ama hiç çağrılmayan API | `setVolume`, `getVolume`, `setWaveIntensity`, `getBeatPulse` |
| Hiç sesi olmayan olay | ayak sesi, zombi vokali, düşman ölümü, spawn telegraph'ı, boss slam telegraph'ı, sığınak ambiyansı, hava |

Ölü metotlar: `playLaser`, `playPlasmaBlast`, `playShotgunBlast`,
`playBulletImpact`, `playCoinPickup`, `playComboKill`, `playRoomClearFanfare`,
`playLevelUp`, `playWaveStart`, `playDash`. Hepsi projenin sci-fi döneminden
kalma ve hepsi bugünkü ton kuralının ihlali. Sırf orada durdukları için dosyada
çalışmak zor.

### Üç yapısal sorun

**1. Her gürültü patlaması aynı sesi çalıyor.** `bug.md` #11. Tampon 1.2
saniyelik ama `src.start(t0)` offset almadığı için her patlama aynı ilk dilimi
okuyor. Ranger saniyede 8.7 mermi atıyor ve hepsi birebir aynı örnek.

**2. Ses seviyesi kodda sabit.** `masterVolume = 0.3`, `setVolume()` yazılmış
ama hiçbir yerden çağrılmıyor. Tek kontrol `M` ile tam susturma.

**3. Her şey mono, ortada ve mesafeden bağımsız.** 40 metre öteki bir
shambler'ın vuruş sesi, dibindekiyle aynı seviyede ve aynı yerden geliyor.
Sabit kameralı, sürü tabanlı bir oyunda kaybedilen en büyük bilgi kanalı bu.

---

## 1. FAZ 0 — TEMİZLİK VE KONTROL *(MVP)* *(yapıldı)*

Ses üstünde çalışmadan önce yapılması gerekenler. İkisi de düşük riskli.

**0.1 — Ölü kodu sil.** 10 metot, ~460 satır. Sıfır çağrı yeri olduğu ölçüldü;
`tsc` ve oyun akışı etkilenmiyor. Dosya ~200 satıra iner ve üstünde çalışılır
hâle gelir.

**0.2 — Ses seviyesi kaydırıcısı.** `setVolume()`/`getVolume()` zaten var;
iş, settings kartına bir kaydırıcı koymak ve `DisplaySettings`'e bir alan
eklemek (`fpsCap` ve `showFps`'in yanına, aynı şema doğrulamasıyla). Sesi açık
başlayan bir tarayıcı oyununda bu MVP maddesidir ve **ses yüksekliğine
dokunacak her işten önce gelmeli.**

**0.3 — Ses test sayfası.** `?audio=test` ile açılan, her olayı bir tuşa bağlı
çalan küçük bir sayfa. Boss kükremesini duymak için boss'a kadar oynamak
gerekmesin. Aşağıdaki her fazın dinleme turunu kısaltan tek yatırım budur;
maliyeti bir saat, geri dönüşü her turda.

**Kabul:** dosya 250 satırın altında, `tsc --noEmit` temiz, kaydırıcı seviyeyi
gerçekten oynatıyor ve sayfa yenilendiğinde korunuyor.

### Nasıl yapıldı

**0.1 — 256 satır silindi**, tahmin edilen ~460 değil. Tahmin dosyanın
tamamına bakıp "sci-fi dönemi" diye ayırdığı bloğu ölçmüştü; on metodun
gövdeleri toplandığında çıkan sayı bu. Dosya **692 → 436 satır**. Yani
kabuldeki "250 satırın altında" tutmuyor ve tutturulamaz — kalan 436 satırın
hepsinin çağrı yeri var (tek istisna `getBeatPulse` ve `setWaveIntensity`;
ikisi de arka plan uğultusuna bağlı, silmek uğultuyu da sökmek demek, o yüzden
bırakıldı). **Kabul kriteri yanlıştı, kod değil.**

**0.2 — Kaydırıcı settings kartında**, frame ceiling'in üstünde. Kayıt
`DisplaySettings.volume` (0–1, varsayılan 0.3 — eskiden koda gömülü olan
sayı). Sürüklerken `onVolumeChange` gain'i canlı oynatıyor, bırakınca
`change` kayda yazıyor: bir sürüklemenin her pikselini localStorage'a
yazmamak için. `M` hâlâ ayrı — susturma sayıya dokunmuyor, yani mute'tan
dönerken seviyeyi yeniden bulmak gerekmiyor.

**0.3 — `?audio=test`** → `src/ui/AudioTestPage.ts`. Dört öbek (Guns / The
player / The dead / The street), 24 olay, her biri bir tuşta ve tıklanabilir;
artı seviye kaydırıcısı ve uğultu anahtarı. Motoru hiç kurmuyor — `main.ts`
sorgu parametresini görünce `Engine` yerine bunu dinamik import ediyor, yani
istenmediğinde bundle'a girmiyor.

**Doğrulandı:** `tsc --noEmit` temiz; bench sayfası konsol hatasız açılıyor ve
24 satırın hepsini gösteriyor; kaydırıcı %65'e çekilip sayfa yenilendiğinde
%65 dönüyor (`lastlight_save_v1.settings.volume = 0.65`).

**Doğrulanmadı:** sesin kendisi. Bu ortamda kulak yok — kaydırıcının gain'i
gerçekten oynattığı kod yolundan okundu, duyularak değil.

---

## 2. FAZ 1 — VARYASYON *(yazıldı, dinlenmedi)*

Sesin "ucuz" duyulmasının birinci sebebi burada, ve düzeltmesi en ucuz olan da bu.

**1.1 — Tampondan rastgele offset.** `src.start(t0, Math.random() * (1.2 - süre))`.
Tek satır. Her patlama artık gürültünün farklı bir yerinden okuyor.

**1.2 — Atış başına sapma.** Ortak bir `vary()` yardımcısı: filtre frekansına
±%6, ses seviyesine ±%8, süreye ±%4. Sayılar **tahmin** — ilk dinleme turunda
ayarlanacak. Amaç fark edilmesi değil, tekrarın fark edilmemesi.

**1.3 — Ağır silahlarda çift katman.** Boomstick ve Widowmaker'ın slap-back'i
şu an sabit gecikmede (0.11 sn). Gecikmeye de sapma girince tek bir "çifte
atış" kalıbı olmaktan çıkıyor.

**Kabul:** Ranger'la üç saniye kesintisiz ateş edildiğinde tekrar duyulmuyor.
**Bu maddeye karar veren kulak, kod değil.**

### Nasıl yapıldı

Üçü de `noiseBurst()` ve `thump()`'ın içine kondu, yani çağıran hiçbir yer
değişmedi — 24 olayın hepsi sapmayı bedavaya aldı.

**1.1** — `src.start(t0, Math.random() * (tampon - süre))`. `loop` zaten
açıktı, o yüzden geç başlayan patlama tamponun başına sarıp devam ediyor.
`bug.md` #11 kapandı.

**1.2** — modül tepesinde `vary(değer, oran)` ve dört sabit: `VARY_FREQ`
(0.06), `VARY_GAIN` (0.08), `VARY_TIME` (0.04), `VARY_DELAY` (0.15).
Filtrenin iki ucu **aynı** çarpanı alıyor: süpürme aynı şekli çizmeli, sadece
aynı yerden başlamamalı. İki ayrı zar silahın karakterini değiştirirdi, atışını
değil.

**1.3** — ayrı bir iş çıkmadı. Gecikme de `vary()`'den geçince sıfır gecikme
sıfır kalıyor (çarpım), yani atışın kendisi tetikte duruyor ve yalnız arkasına
binen katmanlar geziniyor. Slap-back'e geniş bant (`VARY_DELAY` 0.15) verildi:
sokağın karşı duvarına olan mesafe buradaki tek gerçek sebebi olan sayı, ve
0.11 saniyenin %6'sı 7 milisaniye, yani hiç.

### Ölçüm — headless harness, 6 ardışık `playGunshot('light')`

| | Yazılı | Ölçülen aralık |
|---|---|---|
| Tampon offset'i | (yoktu) | 6 atışta 6 farklı yer |
| Filtre başlangıcı | 3200 Hz | 3079 – 3340 Hz |
| Patlama seviyesi | 0.16 | 0.1519 – 0.1711 |
| Çifte'nin slap-back'i | 0.11 sn | 0.0965 – 0.1240 sn |

Çifte'nin ilk iki katmanı altı atışın hepsinde `0.0000`'da: atış tetikte.

**Doğrulanmadı:** tekrarın gerçekten duyulmaz olup olmadığı. Dört sabit de
tahmin ve kabul kriteri kulakta. Dinleme turu `?audio=test` → 1/2/3/4 tuşlarına
üst üste basmak.

---

## 3. FAZ 2 — MEKÂN *(yazıldı, dinlenmedi)*

Işık kuralının ses karşılığı. Şu anda sığınak — tahtalarla kapatılmış bir
bodrum — açık sokakla birebir aynı sesleniyor.

**2.1 — Prosedürel impulse response.** Gürültü × üstel sönüm, ~15 satır, dosya
yok. Tek `ConvolverNode`, sektör tipine göre yüklenen üç ön ayar:

| Mekân | Sönüm | Karakter | Tahmin |
|---|---|---|---|
| Sokak | 0.9 sn | parlak, erken yansıma az | evet |
| Köprü altı (Vic) | 1.8 sn | karanlık, ön gecikmeli | evet |
| Bodrum (sığınak) | 0.35 sn | çok karanlık, dar | evet |

**2.2 — Kuru/ıslak yolu.** Her sesin ne kadar oda alacağına kendisi karar
versin: silah çok, gövde vuruşu orta, arayüz hiç. Arayüz sesinin odası olması
oyunu anında ucuzlatır.

**Kabul:** merdivenlerden inince ses kapanıyor, köprü altında açılıyor.
**Sönüm süreleri tamamen zevk meselesi — kulak gerekir, muhtemelen 2-3 tur.**

### Nasıl yapıldı

**2.1** — `buildIR(id)`: gürültü × üstel sönüm, üstünde tek kutuplu bir alçak
geçiren. `tone` düşükse tepe **gittikçe** kayboluyor, baştan boğuk başlamıyor
— duvarın kuyruktan aldığı ilk şey tiz. İki kanal bağımsız gürültü, yoksa
kuyruk mono oluyor. Tampon `SPACES` sabitinden geliyor ve `irCache`'te
duruyor; ses dosyası yok, hâlâ tek bir ses dosyası yok.

| Mekân | `decay` | `tone` | `predelay` | Ölçülen kuyruk |
|---|---|---|---|---|
| STREET | 0.9 | 0.65 | 0.012 | 0.912 sn |
| UNDERPASS | 1.8 | 0.30 | 0.035 | 1.835 sn |
| BASEMENT | 0.35 | 0.22 | 0.004 | 0.354 sn |

**2.2** — `toOutput(node, pan, wet)`. Kuru yol her zaman var; ıslak yol sesin
kendi verdiği `wet` kadar. **Varsayılan sıfır**, çünkü kapatılması gereken bir
varsayılan açık kalır. Beş oran: `WET_GUN` 0.38, `WET_BLAST` 0.5, `WET_BODY`
0.2, `WET_VOICE` 0.28, `WET_STEP` 0.15. Arayüz hiçbir şey göndermiyor.

Send **panner'dan önce** alınıyor: odanın sağı solu yoktur, şekli vardır.
Kaynağıyla birlikte salınan bir kuyruk mekân değil, stereo efekt gibi duyulur.

Mekân `Engine`'den geliyor: sığınak → BASEMENT, Vic'in köprü altı →
UNDERPASS, geri kalan → STREET. Kamera zaten yeri biliyordu (`useShelter`),
karışım bilmiyordu.

### Ölçüm — headless harness

Kuyruk enerjisi %10 → %60 noktalarında: STREET 0.3002 → 0.0330, UNDERPASS
0.1866 → 0.0212, BASEMENT 0.1308 → 0.0137. Sol/sağ 2000 örneklik pencerede
**0 aynı örnek** (kuyruk geniş). Odaya giden katman sayısı: çifte 2, patlama
3, isabet 1, vokal 2, ayak sesi 1, **arayüz 0**.

**Doğrulanmadı:** sönüm sürelerinin doğru olup olmadığı. Üçü de tahmin ve
kabul kriteri kulakta — `?audio=test` sayfasında ROOM düğmeleri var.

---

## 4. FAZ 3 — KONUM *(oynanışa en çok dokunan faz — yazıldı, dinlenmedi)*

Sürüyü bir bilgi kanalına çeviren şey. Şu anda sürü **tamamen sessiz.**

**3.1 — Panning.** Her dünya sesine `StereoPannerNode`. Kamera sabit dimetrik
(yaw 45°), yani pan değeri kaynağın oyuncuya göre **ekran uzayındaki X'i**.
Bu dönüşüm zaten var: `CAMERA_RIG.facingYaw()`. Kadraj yükseklik cinsinden 28
birim tanımlı, dolayısıyla normalizasyon sabiti de biliniyor.

**3.2 — Mesafe zayıflaması.** 0'da tam, ~34 metrede duyulur sınırında.
Sıfırlanmıyor: kadraj dışından yaklaşan sprinter'ı **duymak isteniyor**, oyunun
baskı hissinin yarısı bu.

**3.3 — Zombi vokalleri.** Tip başına karakter: shambler alçak ve ıslak,
sprinter tiz ve kesik, butcher neredeyse sessiz ve çok alçak, bloater hırıltılı.
Düşman başına 3-6 saniyede bir, faz kaydırmalı.

**3.4 — Ses çalma tavanı.** Ekranda 34 düşman var; hepsi konuşursa çamur olur.
En yakın **4 kaynak** konuşur, gerisi susar. Bu bir optimizasyon değil, karışım
kararı — ve fazın başarısı buna bağlı.

**3.5 — Düşman ölümü.** Şu an sadece `playImpact` var, ölümün kendi sesi yok.
Zincirleme öldürmenin "ısırması" hit-stop'la görsel olarak var, sesle yok.

**Kabul:** gözler kapalı, soldan gelen sprinter'ın soldan geldiği anlaşılıyor.
**Karışım dengesi kulak istiyor ve bu fazda en çok tur burada gider.**

### Nasıl yapıldı

**3.1** — `setListener(x, z)` her karede oyuncudan; `place(at)` kaynağın
oyuncuya göre farkını `CAMERA_RIG.toScreen` ile ekran eksenlerine çeviriyor ve
`halfFrameWidth()`'e bölüyor. Yani pan'in uçları ekranın uçları. Minimap'le
**aynı singleton**, o yüzden ikisi "sol neresi" konusunda ayrışamaz.

**3.2** — `1 / (1 + (d/10)²)`. Tekilliği alınmış ters kare. 34 metrede %7.5 —
sıfır değil, çünkü kadraj dışından gelen sprinter'ı duymak bu fazın **varlık
sebebi.** Kesme yalnız `AUDIBLE_FLOOR` (0.02) altında ve o bir node sayısı
kararı, karışım kararı değil.

**3.3** — `playVocal(type, at)`. Yedi karakter, aynı iki ilkelden: shambler
alçak ve ıslak, sprinter ince ve kesik, butcher **neredeyse hiç** ve tamamen
altta (sokağın en büyüğü, üstüne gelene kadar en sessizi).

**3.4** — `Engine.updateVocals`. Saati **herkes** işletiyor, ama saati dolan
gövde konuşmadan önce "benden yakın kaç kişi var" diye sayıyor; dörtten
fazlaysa susup 1.2 sn sonra tekrar deniyor. Sayım kısmi seçim, sıralama değil
— 34 gövdeyi dört maddelik bir soru için sıralamak saniyede bir sort demek.
Saatlerin hepsinin işlemesi, oyuncu yürüdükçe sokağın anahtar gibi
açılıp kapanmasını engelliyor.

**3.5** — `playDeath(at)`: kısa ıslak bir çatırtı, arkasından ağırlığın yola
inmesi. `playImpact`'i yükseltmek değil — bir öldürmenin anlamını yitirmesinin
yolu odur.

### Ölçüm — headless harness, dinleyici (0,0)

Kadraj yarı genişliği 24.889 birim (28 × 16:9).

| Yer | dünya (x,z) | pan | erim |
|---|---|---|---|
| tam merkez | (0, 0) | 0.000 | 0.99 |
| ekranda sağ, 10 m | (7.07, −7.07) | **+0.402** | 0.53 |
| ekranda sol, 10 m | (−7.07, 7.07) | **−0.402** | 0.46 |
| ekranda yukarı, 10 m | (−7.07, −7.07) | **−0.000** | 0.50 |
| sağ, 28 m | (20, −20) | 1.000 (sınır) | 0.12 |

Mesafe: 0 m %100, 10 m %49, 20 m %21, 34 m %7.5, 50 m %3.6, 80 m'de node bile
üretilmiyor. Merkezde kalması gerekenler — silah, ayak sesi, arayüz, reload —
**hiçbiri panner'a bağlanmıyor.**

**Doğrulanmadı:** karışımın kendisi. Dört sesin çamur mu bilgi mi olduğu,
ölüm sesinin zincirleme öldürmede fazla mı geldiği, vokal aralığının (3–6 sn)
doğru olup olmadığı. Hepsi kulakta.

---

## 5. FAZ 4 — SESİ OLMAYAN OLAYLAR *(kısmen yapıldı)*

| Olay | Neden önemli | Not |
|---|---|---|
| **Ayak sesi** | Oyunun adı "uzun yürüyüş"; yürüyüşün sesi yok | Yürüme döngüsü zaten faz tutuyor (`Player`, bacak `rotation.x`), adım açısı sıfırı geçtiğinde tetiklenir — bedava tetik |
| **Spawn telegraph'ı** | 0.45 sn'lik kanlı halka **sessiz** çiziliyor | Alçak bir sub kabarması "buraya bir şey geliyor" der |
| **Boss slam telegraph'ı** | 0.95 sn'lik hazırlık sessiz, sadece çarpma sesli | Uyarının sesi olmayan telegraph yarım telegraph |
| **Sığınak ambiyansı** | Soba, köpek, uzak damla — çatışma uğultusu değil | §12'nin "burası güvenli" hissini taşıyan şey |
| **Hava** | Sektör başına rüzgâr/yağmur yatağı | Beş bölgeyi kozmetikten çıkaran ucuz kanal |

### Nasıl yapıldı — üçü yapıldı, ikisi durdu

**Ayak sesi.** `Player`'ın yürüme döngüsü `walkCycle` tutuyordu; adım, salınım
sıfırdan geçtiğinde, yani her yarım turda. Yanına sayaç koymak yerine
animasyonu okumak: `Math.floor(önce/π) !== Math.floor(sonra/π)`. Böylece adım
hızı ne olursa olsun ayağın üstünde. Ses bilerek neredeyse hiç
(`volume: 0.045`) — saniyede iki kere, bütün oyun boyunca çalıyor.

**Spawn telegraph'ı.** 0.45 saniyelik kanlı halka artık sessiz değil:
`playSpawnSwell(at)`, alçak bir kabarma. Karışımın *içinde* değil *altında* —
önce hissedilip sonra aranan bir şey.

**Boss slam telegraph'ı.** 0.95 saniyelik hazırlık `playSlamWindup(at)` aldı.
Yerdeki halka yalnızca o an oraya bakana bir şey söylüyordu.

**Yapılmadı:** sığınak ambiyansı (soba, köpek, uzak damla) ve hava yatağı.
İkisi de "sürekli çalan katman" ve sürekli çalan bir katmanın doğru seviyesi
tanım gereği kulak kararı; üstelik ikisi de Faz 2'nin odasıyla etkileşiyor.
Dinlenmemiş bir odanın üstüne sürekli bir yatak koymak, iki bilinmeyeni
birbirine bağlamak olurdu.

---

## 6. FAZ 5 — ADAPTİF KATMAN *(yazıldı, dinlenmedi)*

`setWaveIntensity()` ve `getBeatPulse()` **zaten yazılmış ve hiç
çağrılmıyor.** Adaptif yatak tasarlanmış, bağlanmamış. Yapılacak iş bağlamak:

- Yatağın filtre kesimi ve ikinci katmanın seviyesi, **ekrandaki düşman sayısı
  ve oyuncunun canı** tarafından sürülsün.
- `getBeatPulse()` yavaş bir nabız için yazılmış; hızı tehlikeyle değişsin.
- Long Night kademesi yatağın perdesini indirsin — zorluk seçimi kulaktan da
  okunsun.
- Boss'un kendi yatağı olsun, faz 2'de değişsin.

Bu faz **müzik değil.** Müzik Faz 6'da ve MVP dışında.

### Nasıl yapıldı

`setWaveIntensity` gitti, yerine **`setPressure(0..1)`** geldi. Tek sayı, iki
değil: "kaç tanesi ayakta" ile "oyuncudan ne kaldı" bir yatağa **aynı şeyi**
söylüyor, ikisini ayrı tutmak fazladan basamaklı tek bir kadran olurdu.

`Engine` yarım saniyede bir hesaplıyor (her değer 1 saniyede ramp'liyor, 60
Hz'de sormak birbirini iptal eden 60 ramp demek):
`min(1, min(1, ayakta/22) × 0.65 + (1 − can oranı) × 0.5)`, boss varken taban
0.7 — boss kendi havasıdır, oda dolu olmasa da yatak bunu bilerek yanlış
bilsin.

`getBeatPulse()` de artık çağrılıyor: ikinci osilatörün önüne bir gain kondu
(`bgPulse`) ve nefes onu sürüyor. Hız `beatRate`, baskıyla 0.55 → 1.7. Ritim
değil — ritim oyunun tutmadığı bir söz.

`setBedRoot(hz)`: Long Night kademesi başına ×0.94. Zorluk tahtada seçilip bir
daha hiç duyulmuyordu.

### Ölçüm

| Baskı | Kesim | Seviye | Kök |
|---|---|---|---|
| 0.0 | 250 Hz | 0.045 | 90.0 Hz |
| 0.5 | 525 Hz | 0.073 | 97.2 Hz |
| 1.0 | 800 Hz | 0.100 | 104.4 Hz |

Long Night kökü 90 → 75 Hz (ikinci katman 37.5). Nefes 2 saniyede sessizken
0, baskı altında 3 dönüş.

**Doğrulanmadı:** yatağın fark edilir mi yoksa rahatsız edici mi olduğu.
Amaç yalnızca **durduğunda** fark edilmesi. `?audio=test` → DRONE aç, BED
kaydırıcısını gezdir.

---

## 7. FAZ 6 — GERÇEK FOLEY VE BESTE *(MVP dışı, ve bir tasarım kararı)*

Bu benim yapabileceğim iş değil: gerçek dosya üretmek gerekiyor. İki yol var —
bir ses tasarımcısı, ya da ses üreten bir model (ElevenLabs SFX, Stable Audio).

**Ama bu kararın bir bedeli var:** proje şu anda "~10.700 satır, **0 dış
görsel/ses asseti**, her şey prosedürel" diye sunuluyor ve sunum bunu bir satış
argümanı olarak kullanıyor. Dışarıdan dosya girdiği anda o cümle gider.

Bu teknik değil, konumlandırma sorusu. **Playtest'ten sonra karar verilmeli:**
Faz 1-5 bittikten sonra ses hâlâ zayıf geliyorsa cevap evet, gelmiyorsa
prosedürel hat projenin ayırt edici özelliği olarak kalır.

---

## 8. ÇALIŞMA YÖNTEMİ — DÜRÜST KISIM

**Kodu ben yazarım, sonucu duyamam.** DSP'yi kurabilirim, zarfı ve filtreyi
hesaplayabilirim, ama "çamurlu olmuş" diyemem. Faz 0 dışında her fazın
doğrulaması senin kulağında.

Önerilen döngü, her faz için:

1. Ben yazarım, `tsc` ve oyun akışını doğrularım.
2. Sana **numaralı bir dinleme listesi** veririm — "Ranger'la üç saniye ateş et,
   tekrar duyuyor musun?", "merdivenden in, oda kapanıyor mu?" gibi.
3. Sen madde başına tek satır cevap verirsin.
4. Ayarlarım. Faz başına **2-3 tur** bekliyorum (tahmin).

Faz 0.3'teki test sayfası bu döngünün her turunu kısaltır; o yüzden en başta.

---

## 9. RİSKLER

- **CPU.** Panning + reverb + 34 düşman, WebAudio node sayısını hızla şişirir.
  Ses kaynakları da havuzlanmalı — projenin geri kalanı zaten böyle çalışıyor
  (`ObjectPool`), ses hattı çalışmıyor. Faz 3'ün tavanı bu yüzden karışım
  kararı olduğu kadar bütçe kararı.
- **Ton kayması.** Ses eklerken sinematik dile kaymak çok kolay. Ölü sci-fi
  metotları bunun daha önce bir kez yaşandığının kanıtı. Kural: riser yok,
  braam yok, whoosh yok, "epik" vurgu yok.
- **Sıralama.** Ses seviyesi kaydırıcısı (0.2), sesi yükseltecek her işten
  **önce** gelmeli. Aksi hâlde her dinleme turu oyuncuyu 0.3'e mahkûm eder.
- **Ölçüm yok.** Buradaki hiçbir tur sayısı ölçülmedi. Telemetri gelene kadar
  ses de dahil her denge kararı kulakla veriliyor.

---

## 10. SIRA VE MALİYET

| Faz | İş | Maliyet (tahmin) | Kulak gerekir mi | Durum |
|---|---|---|---|---|
| **0** | Ölü kod, ses kaydırıcısı, test sayfası | yarım gün | hayır | **yapıldı** |
| **1** | Varyasyon (`bug.md` #11 dahil) | yarım gün | evet, 1-2 tur | **yazıldı, dinlenmedi** |
| **2** | Mekân / reverb | 1 gün | evet, 2-3 tur | **yazıldı, dinlenmedi** |
| **3** | Konum + zombi vokalleri | 2 gün | evet, en çok burada | **yazıldı, dinlenmedi** |
| **4** | Eksik olaylar | 1 gün | evet, 1 tur | **3/5 yapıldı** |
| **5** | Adaptif yatak | 1 gün | evet, 2 tur | **yazıldı, dinlenmedi** |
| **6** | Gerçek foley + beste | — | MVP dışı, karar bekliyor | — |

**MVP için gereken Faz 0 bitti.** Gerisi oyunu belirgin şekilde iyileştirir ama
oynanabilirliği tutmuyor — tek istisnası Faz 3, çünkü sessiz bir sürü bir
bilgi eksiği ve bu bir oynanış meselesi.
