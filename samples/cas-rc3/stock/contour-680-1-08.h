0  BEGIN PGM contour-680-1-08 MM 
1  BLK FORM 0.1 Z  X+0  Y-650.8  Z-15
2  BLK FORM 0.2  X+686  Y+0  Z+0
3  ;-------------------------------------
4  ;Tools
5  ;  #27 D=14 - ZMIN=-14.85 - ZMAX=+15 - flat end mill
6  ;-------------------------------------
7  ;
8  * - 2D Contour2
9  M5
10 TOOL CALL 27 Z S5000
11 L M140 MB MAX
12 M3
13 L  X-4.607  Y+10.4 R0 FMAX
14 L  Z+15 R0 FMAX
15 M8
16 CYCL DEF 32.0 TOLERANCE
17 CYCL DEF 32.1
18 L  Z+5 FMAX
19 L  Z-13.45 F333
20 CC  Y+9  Z-13.45
21 CP IPA-90 DR- F1000
22 L  Y+7.6  Z-14.85
23 CC  X-3.207  Y+7.6
24 CP IPA+90 DR+
25 L  X+674.207  Y+6.2
26 L  X+689.207
27 CC  X+689.207  Y+7.6
28 CP IPA+90 DR+
29 L  X+690.607  Y+9
30 CC  Y+9  Z-13.45
31 CP IPA+90 DR+
32 L  Y+10.4  Z+15 FMAX
33 M9
34 M5
35 L M140 MB MAX
36 M30
37 END PGM contour-680-1-08 MM 
