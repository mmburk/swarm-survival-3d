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

## 4. FAZ 1 — VURUŞUN BİR HAZIRLIĞI OLSUN *(en yüksek getiri)*

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

**Neden bu ilk sırada:** yuvarlanmaya (SPACE) gerçek bir anlam veriyor. Şu an
i-frame'ler soyut bir hasar penceresini atlatıyor; bundan sonra **görünen bir
hamleyi** atlatacak. Hades'in dash'inin oyunun merkezinde olmasının sebebi tam
olarak bu.

---

## 5. FAZ 2 — SIRAYI ZAMANLAYICI DEĞİL SALDIRI TUTSUN

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

---

## 6. FAZ 3 — HER SAYI BİR ARALIK OLSUN

`PROFILES`'daki her şey tek sabit. Hades'te neredeyse hiçbir zamanlama tek
sabit değil.

```ts
// Profile'a eklenecek — reset()'te çekilir
windup:   [0.32, 0.48]
recover:  [0.9, 1.6]
standoff: [7.5, 13.0]   // zaten var, aynı biçime taşınır
```

Tek dosya, ucuz, ve Faz 1'in kalabalıkta okunmasını doğrudan iyileştiriyor:
sekiz zombinin hamlesi aynı anda gelmiyor.

---

## 7. FAZ 4 — SIRA TEK HAVUZ DEĞİL, TİPE GÖRE

Hades'te `MaxAttackers` silahın üstünde. Bizde tek bir `lanes` sayısı var,
yani iki Butcher ve bir Burster aynı anda sıraya girebiliyor — sektörün en
sert anı ve **kimse tasarlamadı, kura çıkardı.**

```ts
// updateTurns, iki bütçe
melee  (Shambler, Sprinter) : 3 + sektör × 0.7, tavan 9
heavy  (Butcher, Burster)   : sektör ≤ 4 ise 1, sonra 2
bloater                     : sıra dışı (zaten menzilli)
```

Aynı fonksiyon, iki sayaç. Yan faydası: Butcher gerçekten "duvar" gibi
okunmaya başlıyor, çünkü tek başına geliyor.

---

## 8. FAZ 5 — UYANMA ANI *(düşük öncelik)*

Hades'te `AIAggroRange = 600`, `AggroMinimumDistance = 500`, `IdleUntilAggroAI`
ve `AIResetDistance` var — düşmanların hepsi aynı anda uyanmıyor.

Bizde arena kapalı ve her zombi doğduğu andan itibaren tam bilinçli. Alınmaya
değer tek parça: **telegraph halkasından çıkan gövde 0.3–0.6 saniye duraklasın**
(doğrulur, döner, sonra yürür). Tamamen kozmetik, çok ucuz, ve spawn edilen
dördünün aynı anda aynı yöne dönmesini kırıyor.

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

| Faz | İş | Maliyet | Oynanışa etkisi |
|---|---|---|---|
| 1 | Hazırlık + hamle + toparlanma | Yüksek | **Çok yüksek** |
| 2 | Sırayı saldırı tutsun | Düşük (Faz 1'in üstüne) | Orta |
| 3 | Min/Max varyasyon | Çok düşük | Orta |
| 4 | Tipe göre sıra bütçesi | Düşük | Orta |
| 5 | Uyanma duraklaması | Çok düşük | Düşük (kozmetik) |

Faz 3 ve 4 tek başlarına, Faz 1 olmadan da yapılabilir ve ikisi birlikte yarım
günlük iş. Faz 1 ise gerçek bir sistem değişikliği: temas hasarı modelini
değiştiriyor, yani dengeyi baştan ölçmek gerekiyor.

**Önerilen sıra:** 3 → 4 → 1 → 2 → 5. Ucuz olanlar önce, çünkü Faz 1'in dengesi
ölçülürken zaten yerlerinde olsunlar.
