from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
F="Arial"
blue=Font(name=F,color="0000FF"); black=Font(name=F); bold=Font(name=F,bold=True)
hf=PatternFill("solid",fgColor="1F3864"); hfont=Font(name=F,bold=True,color="FFFFFF")
sec=PatternFill("solid",fgColor="D9E1F2"); yellow=PatternFill("solid",fgColor="FFFF00"); tot=PatternFill("solid",fgColor="E2EFDA")
th=Side(style="thin",color="BFBFBF"); bd=Border(top=th,bottom=th,left=th,right=th)
eur='#,##0.00 "€";(#,##0.00 "€");-'; mad='#,##0 "MAD";(#,##0 "MAD");-'
wb=Workbook(); ws=wb.active; ws.title="Nomenclature (BOM)"
ws["A1"]="VS-1 — Nomenclature avec références exactes et coût par capteur"; ws["A1"].font=Font(name=F,bold=True,size=14)
ws["A2"]="Prix unitaires estimés (nov. 2026), à vérifier chez le distributeur. Bleu = modifiable ; jaune = hypothèse clé. Les valeurs des passifs et des inductances sont à confirmer lors du schéma."; ws["A2"].font=Font(name=F,italic=True,size=9)
ws["A4"]="Taux de change (MAD pour 1 €)"; ws["B4"]=11; ws["B4"].font=blue; ws["B4"].fill=yellow; ws["B4"].number_format="0.00"
ws["C4"]="Hypothèse — à mettre à jour"; ws["C4"].font=Font(name=F,italic=True,size=9)
H=["Fonction","Référence exacte (MPN)","Fabricant","Qté / capteur","P.U. proto min €","P.U. proto max €","P.U. série min €","P.U. série max €","Total proto min €","Total proto max €","Total série min €","Total série max €","Où acheter","Note"]
r=6
for i,t in enumerate(H,1):
    c=ws.cell(r,i,t); c.font=hfont; c.fill=hf; c.border=bd; c.alignment=Alignment(wrap_text=True,vertical="center")
ws.row_dimensions[r].height=32
groups=[
("CERVEAU",[
 ("Compute Module 5 Lite — 2 Go RAM, sans Wi-Fi, sans eMMC","CM5002000","Raspberry Pi",1,75.73,85,70,76,"Reichelt, Kubii, Farnell","75,73 € HT chez Reichelt + 6,95 € de port (geizhals.at, 23/10/2026). Prix série estimé."),
 ("Lecteur de carte microSD (push-push)","1040310811","Molex",1,0.8,1.5,0.5,0.8,"Mouser, DigiKey, LCSC","Nécessaire car le CM5 Lite n'a pas d'eMMC"),
 ("Carte microSD industrielle 16 Go","SDSDQAF3-016G-I","SanDisk (Western Digital)",1,8,12,6,9,"Mouser, DigiKey","Version industrielle, plus fiable qu'une carte grand public"),
 ("Connecteur carte-à-carte 100 broches (côté carte porteuse)","DF40C-100DS-0.4V(51)","Hirose",2,1.5,2.5,1,1.5,"Mouser, DigiKey, LCSC","Même connecteur que la carte officielle CM IO Board"),
 ("Dissipateur passif CM5","Compute Module 5 Passive Cooler","Raspberry Pi",1,4,6,3,4,"Core Electronics (SKU CE10186), Kubii","A$6,80 TTC chez Core Electronics"),
]),
("CIRCUIT IMPRIMÉ",[
 ("Circuit imprimé 4 couches, 90 × 65 mm, 1,6 mm","Fabrication sur mesure (fichiers Gerber)","JLCPCB / PCBWay",1,8,15,2,4,"jlcpcb.com, pcbway.com","Service, pas un composant"),
 ("Assemblage et soudure des composants CMS","Service PCBA","JLCPCB / PCBWay",1,10,25,3,6,"jlcpcb.com, pcbway.com","Service"),
]),
("ALIMENTATION 24 V",[
 ("Fusible CMS 2 A, 63 V (1206)","0466002.NR","Littelfuse",1,0.3,0.5,0.15,0.25,"Mouser, DigiKey, LCSC",""),
 ("Diode TVS surtension 33 V (SMB)","SMBJ33A","Littelfuse",1,0.2,0.4,0.1,0.2,"Mouser, DigiKey, LCSC",""),
 ("Diode anti-inversion Schottky 60 V 3 A","B360B-13-F","Diodes Inc.",1,0.2,0.4,0.1,0.2,"Mouser, DigiKey, LCSC",""),
 ("Condensateur d'entrée 100 µF 63 V","EEE-FK1J101P","Panasonic",1,0.4,0.8,0.2,0.4,"Mouser, DigiKey",""),
 ("Convertisseur abaisseur 60 V / 5 A (24 V → 5 V)","TPS54560BDDAR","Texas Instruments",1,2.5,4,1.8,2.5,"Mouser, DigiKey, LCSC","Calculer les composants avec TI WEBENCH"),
 ("Inductance de puissance 6,8 µH","SRP1265A-6R8M","Bourns",1,0.8,1.5,0.5,0.9,"Mouser, DigiKey","Valeur indicative pour 24→5 V à ~400 kHz"),
 ("Diode Schottky de roue libre 60 V 5 A","B560C-13-F","Diodes Inc.",1,0.3,0.5,0.15,0.3,"Mouser, DigiKey, LCSC",""),
]),
("E/S INDUSTRIELLES",[
 ("Entrée trigger isolée (optocoupleur)","TLP291(GB)","Toshiba",1,0.3,0.5,0.15,0.3,"Mouser, DigiKey, LCSC","Avec résistance série ~4,7 kΩ 0,5 W pour 24 V"),
 ("Sorties OK / NG isolées (relais statique 60 V 0,55 A)","AQY212EHA","Panasonic",2,1.5,2.5,1,1.6,"Mouser, DigiKey","Câblable en PNP ou NPN selon le PLC"),
 ("Protection surtension des E/S 33 V (SMA)","SMAJ33A","Littelfuse",3,0.15,0.3,0.08,0.15,"Mouser, DigiKey, LCSC",""),
 ("Connecteur M12 8 broches mâle, codage A, montage panneau","SACC-DSI-MS-8CON-M12-SCO SH (réf. 1552997)","Phoenix Contact",1,10,16,7,10,"Mouser, RS, Proax","IP67 ; prototype : bornier à vis possible"),
]),
("ÉCLAIRAGE",[
 ("Driver LED à courant constant 40 V 1,5 A","AL8860WT-7","Diodes Inc.",2,0.5,1,0.3,0.6,"Mouser, DigiKey, LCSC","1 driver par série de 3 LED ; broche CTRL pour le flash"),
 ("Inductance driver LED 33 µH","SRN6045-330M","Bourns",2,0.3,0.6,0.2,0.35,"Mouser, DigiKey",""),
 ("LED blanche flash 5000 K, 3030","L130-5080003000W21","Lumileds",6,0.4,0.8,0.2,0.4,"DigiKey, Mouser","LUXEON 3030 2D, 6,1 V 120 mA"),
 ("Voyant vert 5 mm (OK)","WP7113SGD","Kingbright",1,0.15,0.3,0.08,0.15,"Mouser, DigiKey, LCSC",""),
 ("Voyant rouge 5 mm (NG)","WP7113SRD","Kingbright",1,0.15,0.3,0.08,0.15,"Mouser, DigiKey, LCSC",""),
 ("Transistor de commande des voyants","2N7002LT1G","onsemi",2,0.05,0.1,0.02,0.05,"Mouser, DigiKey, LCSC",""),
]),
("RÉSEAU ET CONNECTEURS",[
 ("Prise RJ45 Gigabit avec transformateurs intégrés","7499111121A","Würth Elektronik",1,4,7,3,5,"DigiKey, Farnell, Mouser",""),
 ("Protection ESD Ethernet (4 lignes)","TPD4E05U06DQAR","Texas Instruments",2,0.4,0.8,0.25,0.45,"Mouser, DigiKey, LCSC",""),
 ("Connecteur caméra FPC 22 broches 0,5 mm","FH12-22S-0.5SH(55)","Hirose",1,0.8,1.5,0.5,0.9,"Mouser, DigiKey, LCSC",""),
 ("Prise USB-C (programmation)","USB4105-GF-A","GCT",1,0.5,0.9,0.3,0.5,"Mouser, DigiKey, LCSC",""),
 ("Résistances et condensateurs (0603 / 0805)","Yageo RC0603 / Murata GRM188","Yageo / Murata",1,2,4,1,2,"LCSC","Lot ; valeurs exactes selon le schéma"),
]),
("CAMÉRA ET MÉCANIQUE",[
 ("Caméra 12 MP autofocus (IMX708)","SC0872 (Camera Module 3)","Raspberry Pi",1,25,30,22,27,"Kubii, Farnell, Reichelt","Prévoir ~25 € de plus pour la version global shutter"),
 ("Câble caméra 22 → 15 broches, 200 mm","Câble caméra Raspberry Pi 5 standard–mini","Raspberry Pi",1,1.5,3,1,2,"Kubii, Farnell",""),
 ("Vitre de protection 84 × 60 × 3 mm","Polycarbonate anti-reflet, découpe sur mesure","Local",1,3,8,1,3,"Atelier local",""),
 ("Boîtier (proto : impression 3D PETG ; série : aluminium usiné)","Fabrication sur mesure","Local / JLCPCB CNC",1,5,15,25,45,"Impression 3D locale ; JLCPCB / PCBWay CNC",""),
]),
]
first=r+1
for gname,items in groups:
    r+=1
    ws.cell(r,1,gname).font=bold
    for col in range(1,15): ws.cell(r,col).fill=sec; ws.cell(r,col).border=bd
    for it in items:
        r+=1
        fn,mpn,mfr,q,a,b,c_,d,where,note=it
        vals=[fn,mpn,mfr,q,a,b,c_,d,f"=$D{r}*E{r}",f"=$D{r}*F{r}",f"=$D{r}*G{r}",f"=$D{r}*H{r}",where,note]
        for i,v in enumerate(vals,1):
            c=ws.cell(r,i,v); c.border=bd; c.alignment=Alignment(wrap_text=True,vertical="top")
            c.font=blue if 4<=i<=8 else (Font(name=F,bold=True) if i==2 else black)
            if 5<=i<=12: c.number_format=eur
last=r
r+=1; ws.cell(r,1,"TOTAL par capteur (€)").font=bold
for col in "IJKL":
    c=ws[f"{col}{r}"]; c.value=f"=SUM({col}{first}:{col}{last})"; c.font=bold; c.number_format=eur; c.fill=tot; c.border=bd
te=r; r+=1; ws.cell(r,1,"TOTAL par capteur (MAD)").font=bold
for col in "IJKL":
    c=ws[f"{col}{r}"]; c.value=f"={col}{te}*$B$4"; c.font=bold; c.number_format=mad; c.fill=tot; c.border=bd
r+=1; ws.cell(r,1,"Part du CM5 dans le total").font=black
cmrow=first+1
for col in "IJKL":
    c=ws[f"{col}{r}"]; c.value=f"=IFERROR({col}{cmrow}/{col}{te},0)"; c.number_format="0%"; c.border=bd
for col,w in zip("ABCDEFGHIJKLMN",[44,34,18,8,11,11,11,11,12,12,12,12,26,44]): ws.column_dimensions[col].width=w
ws.freeze_panes="C7"

w2=wb.create_sheet("Coûts uniques")
w2["A1"]="Coûts uniques (une seule fois, pas par capteur)"; w2["A1"].font=Font(name=F,bold=True,size=14)
for i,t in enumerate(["Poste","Min €","Max €","Note"],1):
    c=w2.cell(3,i,t); c.font=hfont; c.fill=hf; c.border=bd
one=[("Pochoir de soudure + frais de lancement",30,80,"Estimation"),
     ("2 à 3 essais de carte avant la bonne version",300,800,"Estimation"),
     ("Certification CE (pour vendre en Europe)",5000,15000,"Estimation, plus tard")]
rr=3
for row in one:
    rr+=1
    for i,v in enumerate(row,1):
        c=w2.cell(rr,i,v); c.border=bd; c.font=blue if i in (2,3) else black
        if i in (2,3): c.number_format=eur
rr+=1; w2.cell(rr,1,"TOTAL (€)").font=bold
for col in "BC":
    c=w2[f"{col}{rr}"]; c.value=f"=SUM({col}4:{col}{rr-1})"; c.font=bold; c.number_format=eur; c.fill=tot
rr+=1; w2.cell(rr,1,"TOTAL (MAD)").font=bold
for col in "BC":
    c=w2[f"{col}{rr}"]; c.value=f"={col}{rr-1}*'Nomenclature (BOM)'!$B$4"; c.font=bold; c.number_format=mad; c.fill=tot
for col,w in zip("ABCD",[48,14,14,30]): w2.column_dimensions[col].width=w

w3=wb.create_sheet("Comparaison Keyence")
w3["A1"]="Comparaison avec un Keyence IV4"; w3["A1"].font=Font(name=F,bold=True,size=14)
for i,t in enumerate(["Hypothèse","Valeur"],1):
    c=w3.cell(3,i,t); c.font=hfont; c.fill=hf; c.border=bd
data=[("Prix d'un Keyence IV4 (€)",3500,eur,True),
      ("Ton prix de vente prévu (€)",1250,eur,True),
      ("Coût composants en série, max (€)",f"='Nomenclature (BOM)'!L{te}",eur,False),
      ("Marge brute par capteur (€)","=B5-B6",eur,False),
      ("Marge brute (%)","=IFERROR(B7/B5,0)","0%",False),
      ("Capteurs à vendre pour couvrir les coûts uniques max","=IFERROR(ROUNDUP('Coûts uniques'!C7/B7,0),0)","0",False),
      ("Économie pour le client vs Keyence (€)","=B4-B5",eur,False)]
for k,(a,v,fmt,inp) in enumerate(data,4):
    w3.cell(k,1,a).font=black; c=w3.cell(k,2,v); c.number_format=fmt; c.font=blue if inp else black
    if inp: c.fill=yellow
    w3.cell(k,1).border=bd; c.border=bd
w3["A12"]="Prix Keyence et prix de vente : hypothèses de notre discussion (IV4 vendu 3 000–4 000 € ; vente prévue 1 000–1 500 €)."; w3["A12"].font=Font(name=F,italic=True,size=9)
w3.column_dimensions["A"].width=56; w3.column_dimensions["B"].width=16
wb.save("VS-1_Estimation_Composants.xlsx")
print(te)
