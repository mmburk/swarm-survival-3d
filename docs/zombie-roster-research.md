# LAST LIGHT — Zombi Kadrosu Araştırması

*Tür oyunlarında kaç çeşit düşman var, hangileri, ve tekrar eden kalıp ne.
Amaç isim toplamak değil: aynı yedi rolün her oyunda farklı isimle çıktığını
gösterip bizde hangisinin eksik olduğunu bulmak.*

**Kaynak notu:** Killing Floor 2 listesi ve Hades verileri doğrudan sayfadan
okundu. Diğerleri arama sonuçlarının özetlerinden; wiki'lerin bir kısmı (Fandom)
doğrudan çekime kapalı. Sayılar sürüme göre değişir — DLC'ler ekliyor.

---

## 1. SAYILAR

| Oyun | Kalabalık | Özel tip | Boss | Aynı anda ekranda |
|---|---|---|---|---|
| **Left 4 Dead** | 1 | 3 + Tank + Witch | — | ~30 |
| **Left 4 Dead 2** | 1 + ~6 "uncommon" | **8** (Tank ve Witch dahil) | — | ~30 |
| **World War Z** | 1 | **6** | — | yüzlerce |
| **Back 4 Blood** | birkaç | **16** (4 aile × 4) | 3–4 | ~20 |
| **Killing Floor 2** | — | **16** | 4 *(sonradan 5)* | ~30 (dalga bazlı) |
| **Dying Light** | 2 (Biter, Viral) | ~10 | — | onlarca |
| **Days Gone** | 1 (Swarmer) | **5** + enfekte hayvanlar | — | **100–600** |
| **7 Days to Die** | çok model, tek davranış | 7 + **2 modifier katmanı** | — | onlarca |
| **Last Light** | 1 (Shambler) | **4** | 1 | 34 |

İki şey hemen göze çarpıyor:

**Sayı, kalabalıkla ters orantılı değil — alakasız.** Days Gone ekranda 500
gövde taşıyor ve **beş** özel tipi var. Killing Floor 2 ekranda 30 gövde
taşıyor ve **on altı**. Yani "kalabalık oyunuz, o yüzden az tipimiz olur"
diye bir kural yok; ama "kalabalık oyunuz, o yüzden az tiple idare edebiliriz"
diye bir gerçek var.

**Bizim 4 özel tipimiz düşük değil.** L4D'nin ilk oyunu 3 + 2 ile bir tür
kurdu. Sorun sayı değil, **hangi rollerin boş olduğu.**

---

## 2. TEKRAR EDEN YEDİ ROL

Bütün bu kadrolar aynı iskeletin üstüne kurulmuş. İsimler değişiyor, iş
değişmiyor:

| # | Rol | L4D2 | WWZ | B4B | KF2 | 7DTD | Days Gone | **Bizde** |
|---|---|---|---|---|---|---|---|---|
| 1 | **Kalabalık** | Common | Zeke | Common | Cyst / Clot | Zombi | Swarmer | Shambler ✅ |
| 2 | **Koşucu** | — | — | — | Alpha Clot | Feral | Reacher | Sprinter ✅ |
| 3 | **Yakalayan** | Hunter, Smoker, Jockey, Charger | Lurker | Stinger, Hocker | Slasher, Crawler | Spider | — | ❌ **YOK** |
| 4 | **Alan reddi** | Boomer, Spitter | Gasbag, Hazmat | Reeker, Retch | Bloat | — | — | Bloater ~ |
| 5 | **Çağıran** | Boomer (safra) | **Screamer** | Snitcher | Rioter | **Screamer** | **Screamer** | ❌ **YOK** |
| 6 | **Duvar / tank** | Tank | Bull | Tallboy, Crusher | Scrake, Fleshpound | Demolisher | Breaker | Butcher ✅ |
| 7 | **Patlayan** | — | Gasbag | Exploder | Bloat | Cop, Demolisher | — | Burster ✅ |
| 8 | *(menzilli)* | — | Infector | Lobber | Siren, Husk | Cop | — | Bloater ✅ |

**İki boş satır var ve ikisi de tesadüf değil.**

### 2.1 Yakalayan (grab / kilitleme)

L4D'nin dört özelinden **dördü** de bu: Hunter üstüne biner, Smoker diliyle
çeker, Jockey sırtına biner, Charger kapıp duvara götürür. B4B'de Stinger ve
Hocker, WWZ'de Lurker, KF2'de Slasher ve Crawler'ın grab'i.

Bu kadar yaygın olmasının sebebi belli: **kalabalık oyununda oyuncuyu bir
saniyeliğine durdurmak, kalabalığın kendisini silaha çevirmenin tek yolu.**
Yoksa hareket eden bir oyuncu kalabalığı sonsuza kadar yönetebilir.

Bizde bunun karşılığı yok. `ArcadePhysics.resolveSoftOverlap` seni itiyor ama
hiçbir şey **tutmuyor.**

### 2.2 Çağıran (screamer)

Altı oyunun **dördünde** var ve hepsinde aynı isimle: Screamer. 7 Days to
Die'da en ilginç hâliyle — Screamer, oyuncunun ürettiği **"Heat"e** göre
doğuyor: demirci ocağı çalıştırmak, üretim yapmak, **silah ateşlemek.** Yani
gürültü bir kaynak, Screamer da onun faturası.

Bizde yok. **Ama oyun bunu zaten vaat ediyor:**

> **The Harvester** — *"Silent. Nails punch clean through a queue of the dead."*
> *"The quiet ones do not call the herd."*

[Weapons.ts](../src/config/Weapons.ts) içindeki bu iki satır bir mekaniğin
sözünü veriyor ve arkasında **hiçbir şey yok.** Harvester şu anda diğer
silahlardan sadece istatistikle ayrılıyor; sessizliğinin oyunda hiçbir karşılığı
yok. Kadroya bir Çığlıkçı eklemek bu çeki bozdurmanın yolu.

---

## 3. İKİNCİ KALIP: YENİ TİP DEĞİL, ÜSTÜNE BİNEN KURAL

Araştırmanın asıl bulgusu bu. Üç oyun, üç ayrı stüdyo, aynı çözüm:

### 3.1 L4D2 — "uncommon common"

Kalabalığın kendisi, üstüne **tek bir kural** binmiş hâlde. Kampanyaya özel:

| Varyant | Kural |
|---|---|
| **Riot** | Zırhlı — sadece **arkadan** öldürülebilir |
| **Clown** | Gıcırdayan ayakkabılar **başka enfekteleri çeker** |
| **Hazmat / CEDA** | Ateşe bağışık |
| **Mud Men** | Vurdukça **ekranını çamurla kapatır**, dört ayak üstünde gelir |
| **Worker** | Kulaklıklı — boru bombasının sesini duymaz |

Bunların hiçbiri yeni bir düşman değil. Aynı gövde, tek kural, farklı kıyafet.

### 3.2 7 Days to Die — modifier katmanı

| Katman | Ne yapıyor |
|---|---|
| **Feral** | Turuncu gözler, daha çok can, daha sert vuruş, **gündüz de koşar** |
| **Radiated** | Yeşil parıltı, daha sert, **can yeniler** |

Herhangi bir temel zombinin üstüne biniyor. Yani ~30 model × 2 katman.

### 3.3 Back 4 Blood — aile yapısı

16 mutation ama **4 aile**: Tallboy (Bruiser/Crusher/Tallboy/Ripper), Reeker
(Exploder/Retch/Reeker/Shredder), Stinger (Hocker/Stalker/Stinger/Urchin),
Sentinel (Wailer/Swarmer/Sentinel/Lobber). Aynı silüet, farklı kural — oyuncu
uzaktan **aileyi** tanıyor, yakınlaşınca varyantı.

### 3.4 Bu bizim "İşaretliler" planımızın ta kendisi

[enemy-ai-plan.md §12](enemy-ai-plan.md) Hades'in elit niteliklerinden yola
çıkmıştı. Meğer tür oyunları aynı yere kendi başlarına gelmiş — ve **L4D2'nin
uncommon common'ları bizim için Hades'in elitlerinden daha iyi bir model**,
çünkü onlar elit değil, **kalabalığın kendisi.** 34 gövdeyle çalışan şey bu.

Özellikle iki tanesi doğrudan alınabilir:

- **Riot → Yelekli.** Zaten planda vardı. Ama L4D2'nin çözümü daha iyi: hasar
  azaltma değil, **yön**. Önden vurulamaz, arkadan vurulur. Bizim dimetrik
  kameramızda ve `yaw` alanımızda bu bedava — zombinin baktığı yön zaten var.
- **Clown → Zilli.** Çevresindeki bekleyenleri sürekli kendine değil **oyuncuya**
  yönlendiren bir gövde. Sıra sistemine doğrudan bağlanıyor.

---

## 4. ÖNERİ

Kadroyu şişirmeye gerek yok. **İki tip + bir katman**, ve ikisi de boş kalan
rolleri dolduruyor:

### 4.1 Çığlıkçı *(yeni tip)*

Altı oyunun dördünde var, bizde yok, ve Harvester'ın vaadini karşılıyor.

- Oyuncuyu görünce 1.2 sn kurulur (telegraph — Faz 1'in ilk müşterisi), sonra
  çığlık atar
- Çığlık: halkada bekleyen **6 gövdeye anında sıra verir** ve `restTimer`
  sıfırlanır
- Zayıf (25 can) ama uzakta durur — Bloater gibi kiting yapar
- **Gürültüye tepki verir:** sektörde ne kadar çok ses çıkardıysan doğma
  ihtimali o kadar yüksek (7DTD'nin Heat sistemi). Harvester sessiz, Boomstick
  değil.

Bu tek düşman üç sistemi birden ayağa kaldırıyor: sıra sistemi, silah seçimi,
ve şu anda dekoratif olan "sessiz silah" fikri.

### 4.2 Kapan *(yeni tip)*

Kalabalık oyununun eksik dişlisi. L4D'nin dört özelinin ortak noktası.

- Yaklaşır, kavrar, oyuncuyu **1.5 saniye yerinde tutar**
- Kurtulma yolları: **F (itekleme)**, ya da **hayvan** — Rook üstüne atlayıp
  seni kurtarır
- İkincisi asıl sebep: ağıllar oyunun duygusal merkezi ama şu anda hayvanın
  yaptığı iş "biraz hasar". **Seni kurtarması** ile "biraz hasar vermesi"
  arasındaki fark, bir mekanikle bir anı arasındaki fark.

### 4.3 İşaretliler *(katman — plan zaten yazılı)*

L4D2 modeline göre revize: Yelekli **yön tabanlı** olsun (önden zırhlı,
arkadan çıplak), Zilli eklensin.

---

## 5. KAYNAKLAR

- Left 4 Dead 2 — [StrategyWiki](https://strategywiki.org/wiki/Left_4_Dead_2/Infected),
  [L4D Wiki](https://left4dead.fandom.com/wiki/The_Infected),
  [Origins of Special Infected](https://steamcommunity.com/sharedfiles/filedetails/?id=645492653)
- Back 4 Blood — [B4B Wiki: The Ridden](https://back4blood.fandom.com/wiki/The_Ridden),
  [ScreenRant: 9 Special Ridden](https://screenrant.com/back-4-blood-every-special-ridden-type-explained/)
- World War Z — [WWZ Wiki](https://worldwarz.fandom.com/wiki/Zombies),
  [gamepressure](https://guides.gamepressure.com/world-war-z/guide.asp?ID=49917)
- Killing Floor 2 — [Gamers Decide: tüm ZED'ler ve bosslar](https://www.gamersdecide.com/articles/killing-floor-2-enemies-killing-floor-2-bosses),
  [KF2 Wiki](http://www.wiki.killingfloor2.com/index.php?title=Specimens_%28Killing_Floor_2%29)
- 7 Days to Die — [Resmî wiki](https://7daystodie.wiki.gg/wiki/Zombie),
  [BisectHosting: tip dökümü](https://www.bisecthosting.com/blog/7-days-to-die-zombie-types-special-infected)
- Days Gone — [Days Gone Wiki: Freakers](https://daysgone.fandom.com/wiki/Freakers),
  [Samurai Gamers listesi](https://samurai-gamers.com/days-gone/freakers-list/)
- Dying Light — [Dying Light Wiki](https://dyinglight.fandom.com/wiki/Infected)
