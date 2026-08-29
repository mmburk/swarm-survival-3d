# LAST LIGHT — Düşman AI Planı

*Hades'in düşman AI'ının nasıl kurulduğu, bizimkiyle yan yana konması, ve
hangi parçasının bize uyarlanabileceği. Hades sayıları oyunla birlikte gelen
Lua scriptlerinden; bizim sayılarımız koddan. Çıkarım olan yerler "çıkarım"
diye işaretlendi.*

---

## 0. KAYNAK NOTU — ÖNCE BU

Hades kendi oyun scriptlerini **şifrelenmemiş hâlde** dağıtıyor
(`Hades/Content/Scripts/*.lua`). Yani buradaki her şey ikinci elden anlatım
değil, oyunun kendi AI kodu. Okunanlar:

- `EnemyAI.lua` — AI rutinlerinin tamamı
- `EnemyData.lua` — düşman başına AI parametreleri
- `EncounterData.lua` — spawn ve dalga temposu

Kaynak: modcuların aynaladığı [zhang-wen-guang/Hades](https://github.com/zhang-wen-guang/Hades)
deposu. **Uyarı:** bu bir üçüncü taraf kopyası ve oyunun belirli bir
sürümünden; sayılar patch'lerle değişmiş olabilir.

GDC tarafında AI'a dair doğrudan bir konuşma yok — Supergiant'ın yayımlanmış
konuşmaları ([Kasavin](https://www.gamedeveloper.com/design/watch-greg-kasavin-discuss-the-development-of-supergiant-games-i-hades-i-),
[diyalog sistemi](https://gdcvault.com/play/1027149/Breathing-Life-into-Greek-Myth))
anlatı ve diyalog üzerine. Dövüş tasarımı üzerine tek doğrudan kaynak
[Eduardo Gorinstein'ın anlatımı](https://www.digipen.edu/showcase/news/eduardo-gorinstein-delivers-challenge-and-fun-hades)
ve o da oda düzeni ağırlıklı. Yani aşağıdakinin çoğu **koddan okundu**,
röportajdan değil.

---

## 1. HADES NASIL ÇALIŞIYOR

### 1.1 Her düşman bir script, bir steering karışımı değil

Bizim `updateAI()`'mız her kare bütün kuvvetleri toplayıp tek bir yön vektörü
üretiyor. Hades bunu yapmıyor. Her düşman **kendi Lua thread'inde sıralı bir
program** çalıştırıyor — `DoAttackerAILoop`:

```
silah seç  →  hedefi al  →  MoveWithinRange()  →  PreAttack (telegraph)
           →  FireWeaponFromUnit()  →  PostAttackCooldown  →  başa dön
```

Aradaki her adım `wait()` ile bekliyor. Yani düşman "menzile gir" derken
gerçekten o satırda duruyor. Bu, davranışı **okunur** yapan şey: bir Hades
düşmanına bakarken hangi adımda olduğunu görebiliyorsun.

### 1.2 Rutinler bir katalog

`EnemyAI.lua` içinde isimlendirilmiş dokuz kadar davranış var:

| Rutin | Ne yapıyor |
|---|---|
| `AttackerAI` | Standart: yaklaş, kurul, vur, bekle |
| `SurroundAI` | Hedefin etrafında halka kurar, sırayla saldırır |
| `HideAndPeekAI` | Kapak arkasına geçer, çıkar, vurur |
| `LeapIntoRangeAI` | Sıçrayarak mesafe kapatır veya yer değiştirir |
| `RemoteAttack` | Yerinden hiç kımıldamaz, uzaktan atar |
| `PassiveAttack` | Hareketsiz, sürekli ateş |
| `AggroAI` | Oyuncu menzile girene kadar gezinir |
| `IdleUntilAggroAI` | Vurulana kadar hiç uyanmaz |
| `CollisionRetaliate` | Temasla tetiklenir |

Bizde bunun karşılığı `EnemyType` switch'i — ama bizimki **tip** başına, onlarki
**davranış** başına. Aynı düşman farklı silahında farklı rutin kullanabiliyor.

### 1.3 Telegraph birinci sınıf bir alan

Her saldırının bir hazırlığı var ve bu bir animasyon detayı değil, veri:

```
PreAttackDuration, PreAttackAnimation, AttackWarningAnimation
```

Koddan ölçülen gerçek değerler:

| Düşman | PreAttack | PostAttack |
|---|---|---|
| `BaseCaster` (taban şablon) | 0.5 | 0.5 |
| `LightRangedElite` | 0.25 | 0.50 |
| `SpreadShotUnit` | 0.25 | 2.0 |
| `SplitShotUnit` | 0.5 | 2.5 |
| `HeavyRanged` | — | 3.0 |
| `ShieldRangedMiniBoss` | 1.05 | 2.0 |

Görülen kural: **hazırlık kısa (0.25–1.05 sn), toparlanma uzun (0.5–5.0 sn).**
Düşman vurmaya hızlı karar veriyor, sonra uzun süre boşta kalıyor. Oyuncunun
nefes aldığı yer o boşluk.

### 1.4 Saldırı tokeni: `MaxAttackers`

Dün bizim eklediğimiz sıra sisteminin Hades'teki hâli. Paylaşılan tek bir
tablo:

```lua
SurroundEnemiesAttacking[enemy.ObjectId] = true    -- saldırıdan hemen önce
SurroundEnemiesAttacking[enemy.ObjectId] = nil     -- saldırıdan hemen sonra
```

ve saldırı izni:

```lua
if GetDistance(...) <= weaponAIData.AIAttackDistance
   and ( weaponAIData.MaxAttackers == nil
         or TableLength( SurroundEnemiesAttacking ) < weaponAIData.MaxAttackers )
```

Ölçülen değerler: `SpreadShotUnit` 2, `SplitShotUnit` 2, `HeavyRanged` 2,
`HeavyRangedForkedMiniboss` **1**.

İki şey önemli:

1. **Token sadece saldırı boyunca tutuluyor.** Sabit bir "sıra süresi" yok.
   Rotasyon `PostAttackCooldown`'dan kendiliğinden doğuyor.
2. **Token doluysa düşman saldırıyı atlıyor** — beklemiyor, sıraya girmiyor,
   döngünün bir sonraki turunda tekrar deniyor. Yani kim önce gelirse.

`MaxAttackers` **silahın** üstünde, düşmanın değil. Aynı odada iki caster
ateş ederken melee'ler tamamen ayrı bir bütçeden çalışıyor.

### 1.5 Halka: `SurroundDistance`

`SurroundAI` düşmanı hedefin etrafında sabit bir yarıçapa oturtuyor:

```lua
Move({ Id = enemy.ObjectId, DestinationId = targetId,
       LiveOffsetFromId = enemy.ObjectId,
       LiveOffsetDistance = weaponAIData.SurroundDistance,
       LiveOffsetAngle = 180, SuccessDistance = 50 })
```

Ölçülen: `SpreadShotUnit` 550, `SplitShotUnit` 800, `HeavyRanged` 600 —
`HeavyRanged`'in `AIAttackDistance`'ı ise 700. Yani **halka kendi menzilinin
biraz içinde** (0.86×). Aralarındaki mesafeyi ayarlayan bir alan yok; halka
`LiveOffsetDistance`'tan kendiliğinden çıkıyor.

Bir de `StandOffTime` var: yerine varınca saldırmadan önce beklediği süre.
Bizde karşılığı yok ve **bu, Hades düşmanının vardığında okunur olmasının
yarısı.**

### 1.6 Her sayı bir aralık

Hades'te tek başına duran sabit zamanlama neredeyse yok:

```
PreAttackDurationMin / PreAttackDurationMax
PostAttackCooldownMin / PostAttackCooldownMax
AIMoveWithinRangeTimeoutMin / AIMoveWithinRangeTimeoutMax
AIFireTicksMin / AIFireTicksMax
```

`LightRangedElite`: `AIMoveWithinRangeTimeoutMin = 1.0, Max = 1.5`.

Sürünün aynı anda hareket etmemesi bizde tek bir yerden (sinüs faz kayması)
geliyor; onlarda **her zamanlamadan**.

### 1.7 Ekranda kaç tane var: `ActiveEnemyCap`

Ve işin en çarpıcı kısmı. `EncounterData.lua`, `GeneratedTartarus`:

```
ActiveEnemyCapBase = 2.3
ActiveEnemyCapMax = 8
ActiveEnemyCapDepthRamp = 0.35
```

Yani aynı anda yaşayan düşman sayısı ≈ `2.3 + 0.35 × derinlik`, tavanı **8**.
Spawn aralığı `SpawnIntervalMin = 0.175, SpawnIntervalMax = 0.225`; dalga
sayısı `MinWaves`/`MaxWaves` 1–3; tip çeşitliliği `MinTypes`/`MaxTypes` 1–5.
Zorluk `BaseDifficulty` (Tartarus 30 → Styx 900) ve `DepthDifficultyRamp` ile
ölçekleniyor.

**Hades'in odasında hiçbir zaman sekizden fazla düşman yok.**

---

## 2. YAN YANA

| | Hades | Last Light |
|---|---|---|
| Aynı anda düşman | ≤ 8 | ≤ 34 |
| Aynı anda saldıran | 1–2 (silah başına) | 3–9 (`3 + sektör×0.7`) |
| Sıra ne kadar sürer | Saldırının kendisi kadar | Sabit 6.5 sn |
| Sıra nasıl dağıtılır | Kim önce gelirse (yerel) | 0.45 sn'de bir, en yakına (merkezî) |
| Bekleme halkası | `SurroundDistance` 550–800 | 7.5–13 m |
| Saldırı hazırlığı | Her saldırıda 0.25–1.05 sn | **Yok** (Burster ve boss hariç) |
| Saldırı sonrası boşluk | 0.5–5.0 sn | Yok — temas sürekli |
| Zamanlama varyasyonu | Her alan Min/Max | Sadece halka, yay, salınım fazı |
| Mimari | Düşman başına sıralı script | Kare başına steering karışımı |
| Baskının kaynağı | Saldırı çeşitliliği | Hacim |

Halka mesafesi tesadüfen değil aynı fikirle aynı yerde: ikisi de "oyuncunun
etrafında bir tampon, silah menzilinin biraz içinde". Bunu doğru yapmışız.

**Asıl açık, tabloda tek bir satır: hazırlık.** Hades'te seni öldüren her şeyin
önce bir hazırlığı var. Bizde bir zombi sana değdiği an hasar alıyorsun ve
ekranda bunun bir karşılığı yok — sadece can barı iniyor.

---

## 3. ALMAYACAKLARIMIZ (ve nedeni)

Bir uyarlama planının yarısı budur.

1. **`ActiveEnemyCap` = 8.** Bu bizim oyunumuzu siler. Hades'in baskısı saldırı
   çeşitliliğinden geliyor, bizimki hacimden — kalabalığın kendisi bizim
   fikrimiz. Sıra sistemi zaten "aynı anda kaç tanesi seninle ilgileniyor"
   sorusuna ekrandaki gövde sayısını düşürmeden verilmiş bir cevap.
2. **Düşman başına thread/coroutine.** 8 düşman için doğru mimari, 34 için
   bütçemiz yok. Faz 1'deki durum makinesi bunun küçük hâli — thread değil,
   `updateAI` içinde üç durum.
3. **`HideAndPeekAI` / kapak.** Arenamızda kapak yok, hurda araçlar var ve
   pathfinding yok. Kapaklı davranış pathfinding ister.
4. **Tek hedef varsayımı.** Hades'te düşman daima Zagreus'u hedefliyor. Bizde
   Nan var, hayvan yemi bizim farkımız; onu düzleştirmeyelim.

---

## 4. FAZ 1 — VURUŞUN BİR HAZIRLIĞI OLSUN *(yapıldı)*

**Bugün:** temas hasarı saf çakışma testi ([Engine.ts:1471](../src/core/Engine.ts:1471)).
Zombi sana değiyorsa `contactDamage` alıyorsun, oyuncunun 0.45 sn i-frame'i
var, o kadar. Uyarı yok, ıskalama yok, hasarın kaynağı ekranda görünmüyor.

**Uyarlama:** `Enemy`'ye üç durumlu küçük bir makine — Hades'in
`PreAttackDuration` / `Fire` / `PostAttackCooldown` üçlüsünün bizim ölçeğimize
inmiş hâli:

```
CLOSING  →  menzile girince WINDUP (≈0.4 sn: durur, hafifçe geri çekilir,
            bir işaret yanar, sesi çıkar)
WINDUP   →  LUNGE (≈0.18 sn: öne atılır; o an çakışma varsa hasar,
            yoksa ıskalar)
LUNGE    →  RECOVER (≈0.9–1.6 sn: geri çekilir, saldıramaz)
```

Temas hasarı sıfırlanmıyor ama **sürtünmeye** iniyor: `contactDamage × 0.25`,
1.2 sn'de bir. Kalabalığın içinde durmak hâlâ cezalı, ama artık asıl öldüren
şey görülebilir bir hamle.

**Dokunulan yerler:** `Enemy.ts` (durum + timer + menzil), `Engine.ts` (temas
çözümü ikiye ayrılır: sürtünme ve hamle), `InstancedEnemies.ts` (windup
görseli), `AudioManager.ts` (bir hamle sesi).

**Neden bu ilk sırada:** yuvarlanmaya (SPACE) gerçek bir anlam veriyor. Eskiden
i-frame'ler soyut bir hasar penceresini atlatıyordu; artık **görünen bir
hamleyi** atlatıyor. Hades'in dash'inin oyunun merkezinde olmasının sebebi tam
olarak bu.

### Nasıl yapıldı

`SwingState` — `NONE → WINDUP → STRIKE → RECOVER`, sadece üç tipte
(Shambler, Sprinter, Butcher). Diğerlerinin zaten kendi hasar kaynağı var
(safra, şişme, tutuş, çığlık) ve onlara bir de yumruk vermek her birinin ne
işe yaradığını bulanıklaştırırdı.

- **Menzil:** gövdenin yarıçapı + 1.45 m. Butcher'ınki (1.55) doğal olarak
  daha uzun — büyük olanın erişimi de büyük.
- **Süreler gövdeye özel**, Faz 3'ün bantlarından: Shambler 0.34–0.50 sn
  hazırlık / 1.0–1.7 sn toparlanma, Sprinter 0.22–0.32 / 0.7–1.1, Butcher
  0.50–0.70 / 1.6–2.4. Sekizi aynı anda geldiğinde koro hâlinde vurmuyorlar.
- **Hamle taahhütlü:** yön, hazırlık bittiği anda kilitleniyor ve 0.18 saniye
  boyunca 6 m/sn ileri atılıyor. Yani yana adım atmak işe yarıyor, durmak
  yaramıyor.
- **Sırası olmayan hiç vurmuyor.** Halkada bekleyen gövde hazırlığa bile
  girmiyor — beklemek bu demek.
- **Sersemleme hazırlığı iptal ediyor.** İtekleme (F) artık kalkan.
- **İşaretlilerin hazırlığı ×0.6.** Hades'in elitten aldığı şey kalınlık değil
  zaman: `LightRangedElite`'in `PreAttackDuration`'ı 0.5'ten 0.25'e iniyor.
  Aynı gövde, aynı hamle, okumak için daha az süre.

**Görsel:** renk kanalı doluydu (hit flash, Burster'ın gazı, işaret rengi) ve
dokuz gövde aynı anda kurulurken onuncu bir ton gürültü olurdu. Onun yerine
**siluet**: `swingPose` -1'den +1'e gidiyor, kollar geriye çekiliyor ve gövde
arkaya yaslanıyor, sonra ikisi birden öne fırlıyor. Sokağın öbür ucundan
okunuyor çünkü şekli değiştiriyor.

**Temas hasarı sürtünmeye indi:** artık gövde başına değil, **oyuncu başına**
1.1 saniyede bir, dokunan gövdelerin temas hasarının %25'i, en fazla 3 gövde
sayılıyor. Sebep: altı tanesinin üstüne yığılması birinden kötü olmalı, ama
altı katı kötü olmamalı.

### Ölçüm — eski model vs yeni

İkisi de gerçek kodla, oyuncunun 0.45 sn dokunulmazlığı modellenerek
(eski sayılar için çalışan ağaç `git stash`'lendi):

| Senaryo | ESKİ dps | ölüm | YENİ dps | ölüm |
|---|---|---|---|---|
| Sektör 1, hiç kımıldamıyor | 19.6 | 5.1 sn | **12–14** | 7–9 sn |
| Sektör 1, sürekli kaçıyor | 1.4 | 70 sn | **0.6–1.8** | 55–167 sn |
| Sektör 5, hiç kımıldamıyor | 27.6 | 3.6 sn | **25–28** | 3.6–4.1 sn |
| Sektör 9, hiç kımıldamıyor | 27.6 | 3.6 sn | **32–34** | 3.0 sn |

Toplam hasar aynı büyüklük sırasında kaldı — yani oyunun zorluğu alt üst
olmadı — ama iki şey değişti:

1. **Artık okunuyor ve kaçınılabiliyor.** Duran oyuncuya hamlelerin %69'u
   isabet ediyor, kaçan oyuncuya %18–20'si.
2. **Kalabalık artık gerçekten ölçekleniyor.** Eski modelde sektör 5 ve 9
   aynı sayıyı veriyordu (27.6) çünkü oyuncunun i-frame'i doyuma ulaşıyordu —
   ekranda 20 gövde de olsa 40 gövde de olsa fark etmiyordu. Yenisi 14 → 25 →
   34 diye çıkıyor.

`STRIKE_MULTIPLIER` 1.75 (plan 1.4 öngörmüştü; ölçünce daha fazlasını istedi,
çünkü toparlanma süresi duran bir oyuncunun bile eskisinden az vurulması
demek).

---

## 5. FAZ 2 — SIRAYI ZAMANLAYICI DEĞİL SALDIRI TUTSUN *(yapıldı)*

Faz 1 gelince `TURN_LENGTH = 6.5` gereksizleşiyor. Hades'teki gibi: sıra
WINDUP başlarken alınır, RECOVER biterken bırakılır.

```ts
// updateTurns, Faz 2 sonrası
sıra alınır   → düşman WINDUP'a girdiğinde
sıra bırakılır → RECOVER bittiğinde, restTimer = kendi RECOVER süresi
```

Kazancı: sıra süresi artık keyfi bir sabit değil, saldırının kendisi. Ve tip
farkı sıraya da yansıyor — Sprinter sırayı çabuk bırakıyor, Butcher uzun
tutuyor, çünkü hamleleri farklı uzunlukta.

**Bizim sistemin Hades'ten iyi olan yanını koruyoruz:** onlarda token doluysa
düşman saldırıyı atlıyor ve sıra kimseye verilmiyor — kim önce gelirse. Bizde
0.45 sn'de bir **en yakındakiler** seçiliyor. Bu daha okunaklı ve daha adil;
geri adım atmıyoruz.

### Nasıl yapıldı, ve planın görmediği tuzak

`Enemy.turnSpent` — hamle toparlanmayı bitirdiği an true. Sıralamada:

```ts
if (e.engaged) {
  if (e.turnSpent || e.turnTimer > e.turnLength * 2) return d + 40;  // bırak
  return d - 3;                                                      // yapışkan
}
```

Sayaç tamamen kalkmadı, **güvenlik ağına** dönüştü: oyuncu kaçıyorsa sırası
olan gövde hiç menzile giremez, hiç vuramaz, ve `turnSpent` hiç true olmaz —
sıraya sonsuza kadar oturur. Kendi sıra süresinin iki katı geçtiyse fırsatını
kullanmış sayılıyor.

**Tuzak:** sırayı bırakan gövde bekleme halkasına (7.5–13 m) geri yürüyordu.
Her hamleden sonra 8 metre gidip 8 metre gelmek, saniyede 2.6 metre yürüyen
bir Shambler için sokağın çoğunu yürüyerek geçirmek demek — ve baskının
çökmesi demek. Çözüm iki halka:

```ts
const ring = this.restTimer > 0 ? this.standoff * 0.42 : this.standoff;
```

Hiç sırası gelmemiş gövde tam mesafede **kuyrukta bekliyor**; az önce vurup
devredilen gövde kolun biraz ötesinde **asılı duruyor**. Kalabalık iki
hamle arasında sekiz metre geri çekilmez.

**Plandan sapma:** plan `restTimer = kendi RECOVER süresi` diyordu (Shambler
için 1.0–1.7 sn). Denenince çok hızlı geliyor: gövde devrediliyor, bir saniye
sonra yine en yakın olduğu için sırayı geri alıyor, yeni gelen bumpleniyor.
`restLength` bandı (3.0–6.0 sn) korundu.

### Ölçüm — sayaçlı sıra vs saldırının tuttuğu sıra

Aynı tohumlar, 40 saniye, 3 koşunun ortalaması:

| Senaryo | dps önce → sonra | devir/sn önce → sonra | kaç ayrı gövde vurdu |
|---|---|---|---|
| Sektör 1, duruyor | 14.8 → **13.3** | 0.44 → **0.77** | 7 → **8** |
| Sektör 5, duruyor | 28.0 → **23.6** | 0.85 → **1.56** | 14 → **17** |
| Sektör 5, kaçıyor | 4.2 → **1.8** | 1.43 → 1.39 | 12 → 11 |
| Sektör 9, duruyor | 30.1 → **28.6** | 1.23 → **2.24** | 20 → **22** |

Devir hızı neredeyse ikiye katlandı ve **hamle başına bir devir** oluyor —
tasarlandığı gibi. Hasar %5–15 düştü, çünkü devredilen gövde bir sonraki
hamlesine kadar geri çekiliyor; sayılar hâlâ Faz 1'in bandında.

Kaçan oyuncuda düşüş daha büyük (4.2 → 1.8) ama hamle sayısı aynı (0.39 →
0.38) — yani aynı sayıda hamle atılıyor, daha azı tutuyor. Saf kiting fazla
güvenli gelirse ayar noktası `standoff * 0.42` çarpanı ya da `rest` bandı.

---

## 6. FAZ 3 — HER SAYI BİR ARALIK OLSUN *(yapıldı)*

`Profile` artık altı **bant** taşıyor ve her biri gövde başına, spawn anında
bir kez çekiliyor (`Range` + `roll()`, `Enemy.ts`):

| Bant | Ne | Kim okuyor |
|---|---|---|
| `pace` | Hızın çarpanı | Hepsi |
| `standoff` | Bekleme halkasının yarıçapı | Hepsi (Screamer kendi duruşu için) |
| `turn` | Sırayı ne kadar tutuyor | Sıra sistemi |
| `rest` | Sırayı bıraktıktan sonra ne kadar bekliyor | Sıra sistemi |
| `windup` | Yapacağı şeyden önceki duraklama | Screamer'ın nefesi, Clinger'ın hamlesi, Burster'ın şişmesi |
| `recover` | Sonrasındaki bekleme | Aynı üçü + Bloater'ın tükürme temposu |

Bu, dört ayrı sabiti (`TURN_LENGTH`, `TURN_REST`, `SCREAM_WINDUP/COOLDOWN`,
`GRAB_WINDUP/COOLDOWN`, `SCREAM_STANDOFF`) ortadan kaldırdı — hepsi artık
profilin bandından geliyor.

Ölçüm (aynı tipten 200 gövde):

```
SHAMBLER   hız 2.19–3.01   halka  7.6–13.0   sıra 5.6–7.5   dinlenme 3.0–4.2
SPRINTER   hız 6.89–7.91   halka  9.1–14.0   sıra 3.5–5.5   dinlenme 2.2–3.4
BUTCHER    hız 2.76–3.04   halka  6.5–9.0    sıra 7.5–10.0  dinlenme 4.0–6.0
CLINGER    hız 4.79–5.71   halka  5.5–8.0    sıra 4.5–6.5   dinlenme 4.0–6.0
SCREAMER   hız 3.07–3.74   halka 14.0–16.5   sıra 5.5–7.5   dinlenme 3.0–4.2
```

Bantlar tipin karakterini de taşıyor: Butcher sırasını 7.5–10 saniye tutuyor
(altı saniyede rotasyona giren duvar, duvar değildir), Sprinter 3.5–5.5 (girip
çıkıyor), Clinger halkanın **içinde** bekliyor (5.5–8 m) çünkü beklediği şey
sıra değil, boşluk.

**Görünen etkisi:** 22 metreden aynı çember üzerinde gelen 20 shambler, 8
saniye sonra **8.7 metreye yayılmış** hâlde varıyor. Eskiden hepsi aynı hizada
gelirdi.

`windup`/`recover` üç tipte bugün canlı; Shambler, Sprinter ve Butcher'ınki
Faz 1'in yakın dövüş hazırlığı için hazır bekliyor.

---

## 7. FAZ 4 — SIRA TEK HAVUZ DEĞİL, TİPE GÖRE *(yapıldı)*

Hades'te `MaxAttackers` silahın üstünde. Bizde tek bir `lanes` sayısı vardı,
yani iki Butcher ve bir Burster aynı anda sıraya girebiliyordu — sektörün en
sert anı ve **kimse tasarlamadı, kura çıkardı.**

`updateTurns` artık üç kuyruk dağıtıyor:

```ts
melee  (Shambler, Sprinter) : min(9, 3 + sektör × 0.7)  + çığlık varsa 6
heavy  (Butcher, Burster)   : sektör ≤ 4 ise 1, sonra 2
grab   (Clinger)            : sektör ≤ 5 ise 1, sonra 2
dışarıda (Bloater, Screamer): kendi mesafelerini kendileri tutuyor
```

Ölçüm — aynı sokak (16 shambler, 4 sprinter, 3 butcher, 3 burster, 5 clinger):

```
sektör 1    melee 3    heavy 1    grab 1
sektör 5    melee 6    heavy 2    grab 1
sektör 9    melee 9    heavy 2    grab 2
sektör 5 + çığlık:  melee 12   heavy 2   grab 1
```

Son satır önemli: **çığlık yalnız kalabalığı açıyor.** Screamer halkayı senin
üstüne çeviriyor, sana ikinci bir Butcher getirmiyor.

Yan faydaları: Butcher gerçekten "duvar" gibi okunmaya başlıyor çünkü tek
başına geliyor, ve Clinger'ın "sektör 5'te altı tane var, hepsi tutabilir"
riski (fikirler.md'de yazılıydı) bütçeyle çözüldü — beşi de sokakta ama biri
tutabiliyor.

---

## 8. FAZ 5 — UYANMA ANI *(yapıldı)*

Hades'te `AIAggroRange = 600`, `AggroMinimumDistance = 500`, `IdleUntilAggroAI`
ve `AIResetDistance` var — düşmanların hepsi aynı anda uyanmıyor.

Bizde arena kapalı ve her zombi doğduğu andan itibaren tam bilinçliydi.
Alınmaya değer tek parça: **telegraph halkasından çıkan gövde duraklasın**
(doğrulur, döner, sonra yürür).

Yapılan: `Profile`'a yedinci bant, `wake`. Ve asıl işi yapan ikinci satır —
gövde artık `yaw = 0` ile değil, **rastgele bir yöne bakarak** doğuyor, sonra
uyanma süresi boyunca oyuncuyu buluyor. Tek telegraph'tan çıkan dördü eskiden
aynı anda, zaten oyuncuya dönük hâlde ayağa kalkıyordu.

| Tip | Bant | Ölçülen (100 gövde) |
|---|---|---|
| Sprinter | 0.15–0.30 | 0.17–0.30 sn |
| Clinger | 0.25–0.45 | 0.27–0.45 sn |
| Burster | 0.30–0.55 | 0.32–0.57 sn |
| Shambler | 0.35–0.65 | 0.37–0.67 sn |
| Bloater / Screamer | 0.40–0.70 | 0.42–0.70 sn |
| Butcher | 0.60–1.00 | 0.62–1.00 sn |

Sprinter'lar taze döndükleri için çabuk toparlanıyor, Butcher bir saniyeye
kadar alıyor. Tek halkadan çıkan dört Shambler'ın oyuncuya bakma hatası
başlangıçta 134° / 150° / 8° / 14°, yarım saniye sonra hepsi sıfır, ve ilk
adımlarını 0.06 / 0.53 / 0.30 / 0.52 metre farkla atıyorlar.

**Kozmetik değil, bir kuralı da var:** uyanırken vurulan gövde uyanmayı
bırakıyor (`takeDamage` içinde `wakeTimer = 0`). Ölçüldü: dokunulmayan bir
Butcher 0.6 saniyede 0 metre gidiyor, 0.2 saniyede vurulan aynı Butcher 0.92
metre. Yoksa "ateş ettim, öylece durdu" hissi olurdu.

---

## 8.5 SONRADAN ÖLÇÜLEN — ŞERİT SİSTEMİNİN SINIRI

*Beş faz bittikten sonra bir dövüş harness'ı yazıldı (`npm run combat`) ve
plandaki bir varsayımı çürüttü. Buraya yazılıyor çünkü planın kendisiyle
ilgili, ayarla değil.*

### Şerit bütçesi kaçan oyuncuya karşı bağlayıcı kısıt değil

Hades'in `MaxAttackers`'ı ve bizim üç kuyruğumuz aynı soruyu cevaplıyor: *aynı
anda kaç tanesi üstüne gelebilir?* Ölçüldüğünde çıkan şey: hareket eden bir
oyuncu için bu sorunun cevabı **hiçbir şeyi değiştirmiyor.**

| Deney | Kaçan oyuncuda hasar |
|---|---|
| Gürültüyle +2 şerit (dolu sayaç) | %1–4 |
| Kalıcı açık +6 şerit (bitmeyen çığlık) | ~0, sektör 9'da **−%25** |

Eksi işareti tesadüf değil, mekanizma. Şeritler kimin **hücum edeceğine** karar
veriyor. Devreye giren gövde halkayı bırakıp doğrudan geliyor — ve hareketli
bir hedefin **arkasına** diziliyor. Halkada kalan gövde ise oyuncu daireyi
tamamlarken **önüne** çıkıyor. Yani ön safı genişletmek, kaçan oyuncuyu
gerçekten yaralayan şeyi (halka) boşaltıyor.

### Bunun plan için anlamı

- **Faz 4'ün üç kuyruğu duran oyuncu için doğru, kaçan oyuncu için ilgisiz.**
  Yanlış değil — Butcher+Burster'ın aynı anda basmasını hâlâ engelliyor — ama
  "kiting'e karşı ne yapacağız" sorusunun cevabı burada değil.
- **Çığlıkçının şoku duran oyuncuya karşı.** 4'ten 10'a çıkan ön saf, sen
  yürüyorsan bir şey ifade etmiyor. Tipin kendisi hâlâ iş görüyor (uzakta
  durur, bulunması gerekir) ama kartındaki söz koşullu.
- **Kaçmaya karşı doğru kol erişim.** `STRIKE_LUNGE` 6.0 → 8.5 kaçanı %6–23
  yukarı çekerken duranı %1–2'de bırakıyor. `SWING_REACH` bir kadran değil:
  duran oyuncuyu değere göre her iki yöne %30 savuruyor.
- **34'lük tavan uzmanlaşmış tipleri seyreltiyor.** Çığlıkçı ve Kapan sokakta
  bir melee gövdenin yerini alıyor; kaçan oyuncuya karşı tam kadro ile
  melee-only kadro arasında ortalama fark sıfır.

Bir sonraki kişi "kiting fazla güvenli" derse: bütçeye dokunma. Erişim,
öngörü (nereye gideceğini kesmek) ya da menzil — hücum eden gövde sayısı değil.

---

## 9. RİSKLER

**Faz 1 dengeyi kesin bozar.** Hamleli saldırı ıskalanabildiği için düşmanın
saniyedeki hasarı düşer. Telafi `contactDamage`'ı değil **hamle hasarını**
yükselterek yapılmalı (çıkarım: ×1.4 civarı), yoksa kalabalığın ortasında
durmak cezasız hâle gelir — ki bu oyunun tam tersi.

**Faz 1 + yuvarlanma oyunu belirgin şekilde kolaylaştırabilir.** Ölçmeden ayar
yapmayalım. Elimizde headless harness var (vite'ın SSR loader'ı ile `Enemy` ve
`Companion` node içinde koşuyor); iki senaryoda saniyedeki hasar ölçülmeli:
oyuncu hareketsiz, ve oyuncu kaçıyor.

**Windup görseli kalabalıkta kaybolabilir.** Burster'ın `hot` yanıp sönmesi tek
gövdede okunuyor; sekiz gövdede ne olacağı belirsiz. Faz 1'in görsel kısmı
ayrı bir iş olarak ele alınmalı — muhtemelen yerde bir işaret, gövdede değil.

**Sıra ile hayvan hedeflemesi birbirine bağlı.** Faz 2 `engaged`'ın anlamını
değiştiriyor ("sırası var" → "şu an saldırıyor"), ve hayvanların hedef seçimi
`engaged`'a 5 metrelik avans veriyor. Faz 2 yapılırken o avansın hâlâ doğru
şeyi seçtiği tekrar ölçülmeli.

---

## 10. SIRA VE MALİYET

| Faz | İş | Maliyet | Oynanışa etkisi | Durum |
|---|---|---|---|---|
| 1 | Hazırlık + hamle + toparlanma | Yüksek | **Çok yüksek** | **yapıldı** |
| 2 | Sırayı saldırı tutsun | Düşük (Faz 1'in üstüne) | Orta | **yapıldı** |
| 3 | Min/Max varyasyon | Çok düşük | Orta | **yapıldı** |
| 4 | Tipe göre sıra bütçesi | Düşük | Orta | **yapıldı** |
| 5 | Uyanma duraklaması | Çok düşük | Düşük (kozmetik) | **yapıldı** |

**Beş fazın beşi de yapıldı.** Planın açık bıraktığı hiçbir madde kalmadı;
bundan sonrası ayar, ve ayarın yeri masa değil oyun.

---

## 11. ÇEŞİTLİLİK — HADES BUNU NASIL ÇÖZÜYOR

Yukarıda "onların baskısı çeşitlilikten, bizimki hacimden" dedim. Bu doğru ama
eksik: Hades'in çeşitliliği **düşman sayısından gelmiyor.** Tartarus'un temel
kadrosu bir avuç tip. Çeşitlilik, o kadronun üstüne binen bir katman.

### 11.1 Elit varyantlar

`EnemySets.lua` her biyomda temel tipi ve `*Elite` sürümünü yan yana tutuyor
(`Swarmer` / `SwarmerElite`, `HeavyMelee` / `HeavyMeleeElite`). Elit, ayrı bir
düşman değil — aynı gövdenin değiştirilmiş hâli:

| Alan | Ne oluyor |
|---|---|
| `HealthBuffer` | Ek can (SwarmerElite 50, LightRangedElite 120) |
| `IsElite`, `EliteIcon` | İşaretleme |
| `Outline` | Sarı (255,255,0), kalınlaştırılmış |
| `GeneratorData.DifficultyRating` | İki–üç katı |
| `PreAttackDuration` | **Düşürülüyor** — LightRangedElite'te 0.5 → 0.25 |
| `RequiredMinBiomeDepth` | Genelde 3 |

Buradaki asıl ders can değil, **`PreAttackDuration`**: elit sadece daha kalın
değil, **daha hızlı karar veriyor.** Aynı hareketi yapıyor, sana daha az zaman
bırakıyor. Ve derinlik 3'ten önce hiç görünmüyor.

### 11.2 Elit nitelikleri — asıl çarpan

`EnemySets.lua` içinde havuzlar:

```lua
AllEliteAttributes      = { "Blink", "HeavyArmor", "ExtraDamage" }
RangedOnlyEliteAttributes = { "Homing" }
ShadeOnlyEliteAttributes  = { "MultiEgg" }
```

Her biri gerçek bir mekanik:

| Nitelik | Ne yapıyor |
|---|---|
| `HeavyArmor` | `HealthMultiplier = 1.5` (varyantlarda 2.0–4.0). `Frenzy` ve `Vacuuming` ile birlikte gelemez |
| `ExtraDamage` | Mermi hasarı `ChangeValue = 2.0, ChangeType = Multiply` |
| `Blink` | `TeleportationIntervalMin = 5.5, Max = 9.0`; `PreTeleportWait = 0.5` ile ışınlanır |
| `Homing` | Mermi hedefi takip eder, `MaxAdjustRate = math.rad(90)` |
| `MultiEgg` | `AddEnemyOnDeathWeapons` — ölünce düşman doğurur |

Üç yapısal kural var ve üçü de bize aynen uyuyor:

1. **Havuzlar tipe göre kısıtlı.** Takip eden mermi sadece menzilli düşmanda
   anlamlı, o yüzden `RangedOnly`.
2. **Karşılıklı yasaklar var.** `HeavyArmor` `Frenzy`'yi engelliyor, `Blink`
   `Beams`'i. Yani kombinasyonlar serbest bırakılmamış.
3. **Görsel dil sistemin parçası.** Sarı kontur + ikon. Nitelik görünmüyorsa
   nitelik yok demektir.

---

## 12. BİZİM ÇEŞİTLİLİĞİMİZ — "İŞARETLİLER"

Beş tipimiz var ve altıncı bir tip yazmak en pahalı yol: yeni gövde geometrisi,
yeni profil, yeni denge. Hades'in cevabı daha ucuz — **aynı beş gövdenin üstüne
binen bir nitelik katmanı.** Beş tip × dört nitelik, altı satırlık veriyle.

### 12.1 Bedava olan kısım

`InstancedEnemies` zaten örnek başına bir renk çarpanı yazıyor
([InstancedEnemies.ts:239](../src/graphics/InstancedEnemies.ts:239)):

```ts
const flash = e.flashing ? FLASH : e.hot ? HOT : PLAIN;
body.setColorAt(slot, flash);
```

Yani işaretli bir gövdenin görsel dili **bu üçlüye eklenecek bir renk sabiti.**
Hades'in sarı konturunun bizdeki karşılığı bu, ve maliyeti sıfıra yakın. Bu
mimari kararı geçen sefer verdiğimiz için şimdi bedavaya geliyor.

### 12.2 Önerilen dört nitelik

Seçim kriteri: **bizim sistemlerimizle konuşsun.** Hades'ten mekanik kopyalamak
değil, aynı yerden — "temel gövdenin üstüne binen kural" — kendi oyunumuzun
kurallarına dokunan dört şey seçmek.

| Nitelik | Ne yapıyor | Neye dokunuyor |
|---|---|---|
| **Yeleklı** (`HeavyArmor` karşılığı) | Her isabetten sabit bir miktar düşer (çıkarım: 8). Delici mermi ve patlama tam hasar verir | Silah seçimini anlamlı yapar — Harvester'ın delmesi, Ranger'ın el bombası |
| **Çığlıkçı** | Öldüğünde halkada bekleyen 3 gövdeye anında sıra verir | **Sıra sisteminin kendisi.** Öldürme sırasını bir karara çevirir |
| **Öfkeli** (`Frenzy` karşılığı) | Hasar aldıkça hızlanır (2 sn boyunca ×1.5), yığılmaz | Vur-kaç yerine bitirmeyi ödüllendirir |
| **Şişkin** | Ölünce patlar — mevcut `burstOpen()` aynen kullanılır ([Engine.ts:1789](../src/core/Engine.ts:1789)) | Kalabalıkta nerede durduğun |

Yasaklar (Hades'in `Frenzy`/`HeavyArmor` çakışmasının bizdeki hâli):

- **Butcher + Yelekli yok.** 210 can + isabet başına −8, Boomstick'le dakikalar
  sürer. Duvarı daha kalın yapmak duvarı daha iyi yapmaz.
- **Burster + Şişkin yok.** Zaten patlıyor.
- **Bloater + Çığlıkçı yok.** Halkanın dışında duran bir gövdenin ölümü
  halkayı çağırmasın; iki sistem birbirini iptal ediyor.
- **Sprinter + Öfkeli yok.** 7.4 hız zaten oyuncunun 8.2'sine kıl payı; ×1.5
  yakalanamaz demek.

### 12.3 Ölçek — Hades'ten ayrıldığımız yer

Hades'in odasında 8 gövde var, biz 34'e kadar çıkıyoruz. **Yüzde ile
dağıtırsak felaket olur:** %20 işaretli = aynı anda 7 elit, ki bu Hades'in
tüm odasından fazla.

O yüzden oran değil, **tavan**:

```
işaretli tavanı = min(3, 1 + floor(sektör / 3))    // sektör 3'te 2, 6'da 3
sektör < 3      = hiç yok                          // RequiredMinBiomeDepth = 3
```

Ve bir ek: işaretli gövde sıra sıralamasında küçük bir avans alsın (çıkarım:
2 m). Yirmi saniye halkada dolanan bir elit, harcanmış bir elittir — Hades'te
elit hep sahnededir çünkü sahnede zaten 8 kişi var. Bizde sahneye çıkarmak
ayrı bir iş.

### 12.4 Nerede duruyor

Bu, 4. fazın (tipe göre sıra bütçesi) doğal devamı ve 1. faza bağlı değil —
`PreAttackDuration` karşılığımız olmadığı için elitin "daha hızlı karar verme"
kısmı şimdilik yapılamıyor. Faz 1 gelince işaretlilere `windup × 0.6`
eklenebilir; Hades'in elitten aldığı asıl şey odur.

| İş | Maliyet | Not |
|---|---|---|
| Nitelik alanı + renk + tavan + yasaklar | Düşük | Tek dosya + iki dokunuş |
| Dört niteliğin mekaniği | Orta | Çığlıkçı ve Şişkin mevcut koda bağlanıyor |
| Codex'te görünmesi | Düşük | Zaten tip listesi var |

**Risk:** dört nitelik dört yeni okuma yükü demek, ve bu oyunun ekranında zaten
34 gövde var. Tek renkle dördünü ayırt etmek mümkün değil — ya nitelik başına
ayrı bir renk (dördü de aynı anda sahnede olabildiği için karışır), ya da
**işaretlilerin hepsi tek renk** ve farkı davranışından okunur. İkincisini
öneriyorum: sarı bir gövde "bunda bir tuhaflık var" demek, tuhaflığın ne
olduğunu oyun sana gösterir.
