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

## 2. FAZ 1 — VARYASYON

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

---

## 3. FAZ 2 — MEKÂN

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

---

## 4. FAZ 3 — KONUM *(oynanışa en çok dokunan faz)*

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

---

## 5. FAZ 4 — SESİ OLMAYAN OLAYLAR

| Olay | Neden önemli | Not |
|---|---|---|
| **Ayak sesi** | Oyunun adı "uzun yürüyüş"; yürüyüşün sesi yok | Yürüme döngüsü zaten faz tutuyor (`Player`, bacak `rotation.x`), adım açısı sıfırı geçtiğinde tetiklenir — bedava tetik |
| **Spawn telegraph'ı** | 0.45 sn'lik kanlı halka **sessiz** çiziliyor | Alçak bir sub kabarması "buraya bir şey geliyor" der |
| **Boss slam telegraph'ı** | 0.95 sn'lik hazırlık sessiz, sadece çarpma sesli | Uyarının sesi olmayan telegraph yarım telegraph |
| **Sığınak ambiyansı** | Soba, köpek, uzak damla — çatışma uğultusu değil | §12'nin "burası güvenli" hissini taşıyan şey |
| **Hava** | Sektör başına rüzgâr/yağmur yatağı | Beş bölgeyi kozmetikten çıkaran ucuz kanal |

---

## 6. FAZ 5 — ADAPTİF KATMAN

`setWaveIntensity()` ve `getBeatPulse()` **zaten yazılmış ve hiç
çağrılmıyor.** Adaptif yatak tasarlanmış, bağlanmamış. Yapılacak iş bağlamak:

- Yatağın filtre kesimi ve ikinci katmanın seviyesi, **ekrandaki düşman sayısı
  ve oyuncunun canı** tarafından sürülsün.
- `getBeatPulse()` yavaş bir nabız için yazılmış; hızı tehlikeyle değişsin.
- Long Night kademesi yatağın perdesini indirsin — zorluk seçimi kulaktan da
  okunsun.
- Boss'un kendi yatağı olsun, faz 2'de değişsin.

Bu faz **müzik değil.** Müzik Faz 6'da ve MVP dışında.

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
| **1** | Varyasyon (`bug.md` #11 dahil) | yarım gün | evet, 1-2 tur | sırada |
| **2** | Mekân / reverb | 1 gün | evet, 2-3 tur | — |
| **3** | Konum + zombi vokalleri | 2 gün | evet, en çok burada | — |
| **4** | Eksik olaylar | 1 gün | evet, 1 tur | — |
| **5** | Adaptif yatak | 1 gün | evet, 2 tur | — |
| **6** | Gerçek foley + beste | — | MVP dışı, karar bekliyor | — |

**MVP için gereken Faz 0 bitti.** Gerisi oyunu belirgin şekilde iyileştirir ama
oynanabilirliği tutmuyor — tek istisnası Faz 3, çünkü sessiz bir sürü bir
bilgi eksiği ve bu bir oynanış meselesi.
