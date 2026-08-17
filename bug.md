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

---

## Açık olanlar

Şu an yok.

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
