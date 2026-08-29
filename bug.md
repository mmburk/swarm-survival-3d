# LAST LIGHT — Bug Kaydı

Çalışma sırasında bulunan hatalar. Düzeltilenler commit'iyle birlikte, açık
olanlar ne yapılması gerektiğiyle birlikte duruyor. Yeni bir bug bulunduğunda
buraya yazılır — düzeltilmese bile.

Sıralama önem sırasına göre değil, bulunma sırasına göre.

---

## Düzeltilenler

### 1. Grid'in paylaşılan query buffer'ı zincirleme ölümlerde listeyi bozuyordu

**Yer:** `src/utils/SpatialHashGrid.ts` — `query()`
**Commit:** `fb77c35`

`query()` her çağrıda aynı diziyi döndürüyordu. Zincirleme bir ölüm — bir ceset
patlıyor, bu komşularını sorguluyor, onlardan biri ölünce o da patlıyor —
üstündeki çağrının hâlâ üzerinde yürüdüğü listeyi sessizce yeniden yazıyordu.
Sonuç: en içteki patlamanın bıraktığı ne varsa yanlış yerde ikinci kez
işleniyordu.

Sorgular artık küçük bir tampon halkasından geliyor. Öldürme yapabilecek üç
çağrı yeri listesinin kopyasını alıyor, mermi geçişi ise kendi kalıcı dizisini
kullanıyor (`Engine.hitCandidates`) — çünkü uzun bir zincir halkayı dolanıp
başa dönebilir.

### 2. Patlamalar arena boyunca hasar veriyordu

**Yer:** `src/core/Engine.ts` — `detonate()`, `burstOpen()`, `onEnemyKilled()` rupture kolu
**Commit:** `fb77c35`

Bu üç yer grid sorgusunun sonucunu "bu yarıçapın içindeki her şey" gibi
kullanıyordu, ama grid bir **broad phase**: hücrelerin tamamını döndürür,
yarıçapı değil. Üstüne integer hash'i iki uzak hücreyi aynı kovaya
düşürebiliyor. Yani bir el bombası, arenanın öbür ucundaki bir zombiyi
öldürebiliyordu.

Üçü de artık mesafeyi kendisi ölçüyor (`withinRadius`, `Engine.ts:67`).

> **Denge notu:** patlamalar ve rupture artık gerçekten yarıçaplarının içinde
> kalıyor, yani eskisinden az sayıda zombi yakalıyorlar. Hasar sayıları
> değişmedi — kapsama alanı düzeldi. Patlamalar zayıf geliyorsa ayarlanacak yer
> yarıçaplar.

### 3. Particle instance buffer'ı havuzdan küçüktü

**Yer:** `src/graphics/ParticleSystem.ts`
**Commit:** `fb77c35`

Havuz 1000 parçacık tutuyordu, `InstancedMesh` ise 600. Üst üste binen iki
patlama havuzu 600'ün üstüne çıkarınca `setMatrixAt` buffer'ın dışına yazıyor,
`count` da buffer'ın ötesini çiziyordu. İkisi de artık aynı sabitten
(`MAX_PARTICLES`) besleniyor ve döngü tavanda kesiyor.

### 4. Zombiler sırtı dönük yürüyordu

**Yer:** `src/entities/Enemy.ts` — `updateAI()`, yaw hesabı
**Commit:** `e19793c`

Modelin yüzü lokal **-Z**'de: çene, iki göz çukuru, yırtık gömlekten görünen
kaburgalar ve öne uzanan iki kol. Ama gövde `Object3D.lookAt` ile
döndürülüyordu — ve `lookAt`, kamera veya ışık olmayan her şey için
argümanlarını ters çevirip hedefe **+Z**'yi yatırır
(`three/src/core/Object3D.js:714-722`).

Yani projenin başından beri bütün zombiler oyuncuya sırtları dönük yaklaşıyor,
kolları arkalarındaki boş sokağı tırmalıyordu — ki o kol uzatma, siluetin
"zombi" gibi okunmasını sağlayan şeyin kendisi.

Horde'u batch'lerken bulundu ve o commit'te **bilerek yanlış bırakıldı**, ki
instanced dönüşümler eski scene graph'a karşı doğrulanabilsin ve birebir aynı
çıksın. Düzeltmesi yarım turu düşürmek.

Ölçüm: beş tipten kırk gövdede yüz, oyuncuya giden doğrunun 0.976'sı içinde;
eksik kalan pay -0.22'lik öne kamburluk.

### 5. Can barları kameraya değil zombiye bakıyordu

**Yer:** `src/graphics/InstancedEnemies.ts` — `barRoot` / `barBack` / `barFill`
**Commit:** `ab0924d`

Barlar yaw'lanan grubun çocuklarıydı, dolayısıyla zombiyle birlikte dönüyorlardı.
Sabit bir `rotation.x = -π/3.4` vardı ama Y ekseninde kameraya hizalanma yoktu.

Ölçüldü: oyuncunun etrafına halka halinde dizilmiş 16 zombinin barlarından
**5'i** kameraya 0.25'ten yakın, yani neredeyse görünmez birer çizgi; **1'i**
tamamen ters dönük (`DoubleSide` sayesinde yine de çiziliyordu). Yani hangi
zombinin canının kaldığını görmek zombinin hangi yöne baktığına bağlıydı.

Barlar artık gövdeden ayrı bir `barRoot` altında ve her kare kameraya
dönüyorlar. İki taraflı bir hata çıktı ortaya: yaw eksikti ama o sabit tilt de
yanlıştı — doğru açı rake'in kendisi (sahada 33°), yazılı olan -52.9°. En iyi
hizalanmış bar bile 21° yatıktı.

Tilt artık elle seçilmiyor, rig'den türetiliyor (`CAMERA_RIG.facingTilt()`,
`facingYaw()`'un yanına eklendi). Sığınak rig'i sahadan 5° dik olduğu için elle
seçilen tek bir sayı ikisinden birinde zaten yanlış olurdu.

Ölçüm sonrası: 16 barın hepsi 0.9999 hizada, sıfırı kenarda; barın kendi X ekseni
kameranın sağıyla birebir (1.0000), yani ekranda yatık durmuyorlar. Hem sahada
(33°) hem sığınakta (38°) doğrulandı. Yan fayda: fill artık her zombide ekranın
aynı tarafından eksiliyor, zombinin baktığı yöne göre değil.

### 6. Hasar sayısı havuzu doluysa uçan bir sayıyı çalıyordu

**Yer:** `src/ui/HUD.ts` — `takeDamageSlot()`
**Commit:** `ab0924d`

```ts
const item = this.dmgPool.find((d) => !d.active) ?? this.dmgPool[0];
```

40 slotun tamamı doluysa slot 0 ne kadar taze olursa olsun kapılıyordu — bir
karelik ömrü olan bir sayı ekranın öbür ucuna sıçrayıp baştan başlıyor, neredeyse
sönmüş bir tanesi ise yerini koruyordu. Artık ömrünün en sonundaki seçiliyor.

### 7. Karakterin botları yürürken yerde çakılı duruyordu

**Yer:** `src/entities/Player.ts` — `buildSurvivor()`
**Commit:** `38f5996`

Botlar hareketsiz `kitMesh`'in içindeydi, bacaklar ise ayrı meshlerdi. Yürüyüş
döngüsü bacakları döndürüyor, botlar yerinde kalıyordu. Üstüne bacak meshinin
origin'i kalçada değil uyluğun ortasındaydı (`position.y = 0.38`, yükseklik
0.72), yani bacak kalçadan değil ortasından sallanıyordu — alt uç ileri
giderken üst uç geri gidiyordu.

Bacak artık uyluk + baldır + bot olarak tek merged geometri ve origin'i kalça
hizasında (`position.y = 0.74`). `rotation.x` gerçek bir adım açısı oluyor.
Mesh sayısı değişmedi.

### 9. Boon sandığı hurda arabanın içine bırakılabiliyordu

**Yer:** `src/core/Engine.ts` — `dropSignal()`
**Commit:** `616c109`

Sokak temizlenince sandık, oyuncudan kadraj yukarı doğru sabit bir mesafeye
bırakılıyordu — sokakta ne olduğuna hiç bakmadan. Ama sokak yanmış sedanlarla
dolu ve oyuncu bir engelden `engel.radius + player.radius` kadar dışarı
itiliyor: bir sedan için **2.85**, sandığın tetik yarıçapı ise **2.3**. Yani
sandık bir arabanın içine düşerse oyuncu halkaya asla değemiyor.

Kapılar sandık alınana kadar kapalı durduğu için bu, koşunun **yerinde
kilitlenmesi** demek: alınamayan bir sandık, açılmayan iki kapı.

Ölçüm (oyuncu düz çizgide sandığa yürütülerek, 300 deneme): **4 başarısız**
(%1.3). Sadece geometriye bakınca, arenaya düzgün dağıtılmış 4000 noktanın
%0.15'inde halkanın içinde durulabilecek tek bir nokta bile yok, %1.45'inde
halkanın %15'inden azı boşta.

Kadraj noktası artık bir dilek: `canStandOn()` ile sınanıyor, tutmazsa oyuncunun
etrafında 30°'lik adımlarla — önce küçük sapmalar, sonra büyükleri — ve gerekirse
iki kat mesafede boş bir yer aranıyor. Hiçbiri olmazsa sandık oyuncunun bastığı
yere bırakılıyor; orası tanımı gereği durulabilir bir yer. Aynı ölçüm sonrasında
400 denemede **1 başarısız**, o da testin duvara sürten aptal yürüyüşünden:
sandığın yeri durulabilir, arada kalan engelin etrafından dolaşmak gerekiyor.

### 10. Sandığın "buraya bas" halkası yolun altında kalıyordu

**Yer:** `src/entities/SignalDrop.ts`, `src/core/Engine.ts` — `dropSignal()`
**Commit:** `616c109`

`SignalDrop` yere `y = 0`'da bırakılıyordu, ama zemin düz değil: `getHeightAt`
±0.28 arası gezen bir noise. Sandık böylece arazinin yarısında gömülü, yarısında
havada duruyordu. Asıl sorun halkada: yerdeki işaret `y = 0.06`'daydı, yani
arenanın **%35'inde zeminin tamamen altında** kalıyordu — ve o halka, ekranda
"buraya bas" diyen tek şey. Mekaniğin çalışmadığı hissi büyük ihtimalle buradan
geliyordu.

Sandık artık altındaki yolun yüksekliğine oturuyor (`placeSignal()` `out.y`'yi
`terrain.getHeightAt` ile dolduruyor), halka da 0.22'ye kaldırıldı — zemin kendi
genişliği boyunca ~0.1 yalpaladığı için ayak bileği hizası yetmiyor. Ölçüm: 400
bırakmanın halka çevresinden alınan 3200 örneğinde **tek bir gömülme yok**
(öncesinde beklenen ~%35).

### 12. Sixpence topladığı hurdayı asla teslim edemiyordu

**Yer:** `src/core/Engine.ts` — `companionWorld.scrapNear()`
**Commit:** `1f74459`

Kuşun hurda araması "oyuncunun mıknatısına zaten girmiş olanı boş ver" filtresi
kullanıyordu, ama mesafeyi **kuşun kendisinden** ölçüyordu. Yani bir hurdaya
3 metreden fazla yaklaştığı anda o hurda aramadan düşüyor, kuş da bir sonraki
en yakına dönüyordu. Sonuç: iki hurda arasında sonsuza kadar gidip gelen, 16
saniyede tek parça toplayamayan bir kuş.

Filtre artık mesafeyi oyuncudan ölçüyor — niyet zaten buydu.

### 13. Kuşun taşıdığı hurda uçuş yüksekliğinde asılı kalıyordu

**Yer:** `src/entities/Companion.ts` — `roleFetch()`, `releaseCarry()`
**Commit:** `1f74459`

Taşınan `Pickup`'ın konumu her karede kuşun altına yazılıyordu, bırakırken de
y'si olduğu yerde kalıyordu. `Engine` ise toplamayı **3B** mesafe testiyle
yapıyor (`distanceToSquared < 1.44`), dolayısıyla oyuncunun 1.6 metre üstünde
asılı duran hurda "neredeyse toplandı" görünüp asla toplanmıyor, 22 saniyelik
ömrü dolunca da yok oluyordu. Ölçüm: 5 parça, 16 saniye, toplanan 0.

Bırakma tek bir yerden geçiyor artık (`releaseCarry`) ve hurdayı altındaki
yolun yüksekliğine indiriyor. Aynı ölçüm: 5/5.

### 14. Bristle kalabalığın içinde durup hiç hücum etmiyordu

**Yer:** `src/entities/Companion.ts` — `roleCharge()`
**Commit:** `1f74459`

Hücum hedefi "en yakın" ceset seçiliyor, sonra hedefe 3 metreden yakınsa hücum
iptal ediliyordu. İkisi birlikte şu anlama geliyor: domuzun üstüne bir zombi
yaslandığı an hücum kalıcı olarak kilitleniyor — hedef hep çok yakın. 20
saniyelik testte 1 öldürme.

Hedef artık **en uzaktaki** ceset (bir hücumun mesafeye ihtiyacı var), hücumlar
arasında da kalabalığın içinde beklemek yerine oyuncunun yanına dönüyor.

> **Denge notu:** düzeltme fazla iyi çalıştı — kalabalık sokakta tek hücum on
> gövde biçiyordu (20 saniyede 29 öldürme, ayının 8'ine karşı). Hücum artık
> üçüncü gövdede duruyor; aynı testte 11.

### 15. Bristle tasmasının dışındaki hedefe hücum ediyordu

**Yer:** `src/entities/Companion.ts` — `roleCharge()`
**Commit:** `a02ea09`

14 numaralı düzeltme hücum hedefini "en uzaktaki ceset" yapmıştı — doğru karar,
çünkü hücumun mesafeye ihtiyacı var. Ama aday listesi grid'den geliyor ve grid
bir **broad phase**: 6 metrelik hücreleri bütün hâlde döndürüyor, yani liste
istenen yarıçapın epey dışına taşıyor. "En uzaktakini seç" ile birleşince
domuz tam da **taşan** cesedi seçiyor.

Ölçüldü: tasması 14 m iken 17 metredeki tek gövdeye hücum etti — 1.5 saniyede
13.5 metre, kavgaya sırtı dönük, üstüne bir de dönüş yolu. Hash çakışması
durumunda mesafe için bir üst sınır da yok.

Aday listesi artık oyuncuya olan mesafesiyle eleniyor. 2 numaralı bug'ın aynısı,
sadece başka bir dosyada.

### 16. Mouser 4 metrelik tehdit kontrolü 5.5 metreyi görüyordu

**Yer:** `src/entities/Companion.ts` — `nearestTo()`
**Commit:** `a02ea09`

Aynı sebep, sessiz hâli. `nearestTo()` yarıçapı grid'e söyleyip sonucu
ölçmeden kullanıyordu; hücre taşması yüzünden kedi 4 metrelik tehdit
kontrolüyle 5.5 metredeki gövdeden kaçıyordu. Aynı fonksiyonu Rook, Honey
ve Nan da hedef seçmek için kullanıyor — onlarda etkisi "tasmanın biraz
dışına çıkmak" oluyordu.

`nearestTo()` artık mesafeyi **origin'e göre** kendisi ölçüyor; sıralama
hayvana olan mesafeye göre kalıyor (niyet buydu: tasma oyuncudan, seçim
hayvandan).

---

### 11. Bütün gürültü patlamaları aynı sesi çalıyor

**Yer:** `src/core/AudioManager.ts` — `noiseBurst()`, `getNoise()`
**Commit:** `TBD`

`getNoise()` 1.2 saniyelik tek bir gürültü tamponu üretip önbelleğe alıyordu —
buraya kadar doğru, amaç zaten her atışta yeniden rastgele sayı üretmemek. Ama
`noiseBurst()` kaynağı hep `src.start(t0)` ile, yani **offset vermeden**
başlatıyordu. Dolayısıyla her patlama tamponun aynı ilk dilimini okuyordu:
Ranger'ın 0.115 saniyede bir attığı her mermi birebir aynı örnek, üstüne
sadece farklı bir filtre zarfı. Tamponun kalan 1.1 saniyesi hiç çalınmıyordu.

Düzeltme iki parça, çünkü offset tek başına yetmiyordu:

1. `src.start(t0, Math.random() * (tampon - süre))` — `loop` zaten açık, yani
   geç başlayan bir patlama tamponun başına sarıp devam ediyor.
2. Atış başına sapma (`vary()`): filtre frekansına ±%6, ses seviyesine ±%8,
   süreye ±%4, gecikmeli katmanlara ±%15. Frekansın iki ucu **aynı** çarpanı
   alıyor — süpürme aynı şekli çizsin, sadece aynı yerden başlamasın.

Ölçüm (headless harness, 6 ardışık `playGunshot('light')`): tamponda 6 farklı
offset, filtre 3079–3340 Hz (yazılı olan 3200), seviye 0.1519–0.1711 (yazılı
olan 0.16). Çifte'nin slap-back'i 0.0965–0.1240 sn arasında geziniyor (yazılı
olan 0.11), ama atışın kendisi tetikte duruyor — sıfır gecikme nasıl
çarpılırsa çarpılsın sıfır kalıyor.

**Kalan:** sayılar tahmin. Doğrulaması kulakta, ve `?audio=test` o iş için var.

---

## Açık olanlar

### 8. 30 fps'in altında oyun ağır çekime düşüyor

**Yer:** `src/core/Engine.ts` — `loop()`
**Durum:** frame ceiling yolu düzeltildi, genel hâli açık.

```ts
const delta = Math.min(Math.max(raw, 0.001), 0.033);
```

Bu kırpma sekme dışına çıkıldığında her şeyin duvarlardan geçmesini önlemek için
var, ama tavanı 1/30. Yani makine gerçekten 30 fps'in altına düşerse geçen
gerçek zamanın bir kısmı her karede yere düşüyor: **oyun yavaşlıyor, kare
atlamıyor.**

Ölçüldü (kare akışı sentetik zaman damgalarıyla sürülerek): 20 fps'lik bir
akışta 2 saniyelik gerçek zamana karşılık oyun **1.32 saniye** ilerliyor —
%66 hız.

Frame ceiling ayarı bunu kendi yolunda düzeltiyor: `maxDelta` artık tavandan
türetiliyor (30 tavanı → 0.0533), yoksa "30 fps'e kilitle" seçeneği oyunu
doğrudan ağır çekime alırdı. Ayar 30 tavanında 2 saniyeye karşılık 1.979 saniye
oyun zamanı veriyor.

Kalan hâli — tavansız çalışan zayıf bir makine — açık. Düzeltmenin bedeli var:
tabanı yükseltmek (mesela 1/15) mermilerin adım başına kat ettiği yolu iki
katına çıkarır, mermi geçişi de grid'i merminin o anki konumunda sorguladığı
için ince zombilerin içinden geçme riski doğar. Doğrusu sabit adımlı bir
birikimli döngü, ama bu şu anki `update(delta)` sözleşmesini baştan yazmak
demek.

---

## Bug değil, ama bilinsin

**`.claude/launch.json` içinde `autoPort: true`.** 5173 başka bir oturumun dev
server'ı tarafından tutulduğu için eklendi. Sabit port gerekiyorsa geri alın.

**Enemy havuzu dolduğunda.** `ObjectPool.get()` eski hâlinde yorumunda "en
yaşlı aktif örneği tekrar kullan" diyor ama `find(i => i.active)` **ilk**
aktifi döndürüyordu, en yaşlıyı değil — yani havuz tavana vurduğunda hep aynı
uçtan çalıyordu. Cursor'a geçince kendiliğinden döner hâle geldi (`fb77c35`).
Tavan 320, sahnede en fazla ~34 zombi tutuluyor, yani pratikte bu kola hiç
girilmiyor.
