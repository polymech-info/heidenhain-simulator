0  BEGIN PGM contour-680-2-08 MM 
1  BLK FORM 0.1 Z  X-480  Y-255  Z-15
2  BLK FORM 0.2  X+200  Y+395  Z+0
3  ;-------------------------------------
4  ;Tools
5  ;  #27 D=14 - ZMIN=-14.85 - ZMAX=+15 - flat end mill
6  ;-------------------------------------
7  ;
8  * - 2D Contour2 (2)
9  M5
10 TOOL CALL 27 Z S5000
11 L M140 MB MAX
12 M3
13 L  X-481.4  Y+406.2 R0 FMAX
14 L  Z+15 R0 FMAX
15 M8
16 CYCL DEF 32.0 TOLERANCE
17 CYCL DEF 32.1
18 L  Z+5 FMAX
19 L  Z-13.45 F333
20 CC  Y+404.8  Z-13.45
21 CP IPA-90 DR- F1000
22 L  Y+403.4  Z-14.85
23 CC  X-480  Y+403.4
24 CP IPA+90 DR+
25 L  X+185  Y+402
26 L  X+200
27 CC  X+200  Y+403.4
28 CP IPA+90 DR+
29 L  X+201.4  Y+404.8
30 CC  Y+404.8  Z-13.45
31 CP IPA+90 DR+
32 L  Y+406.2  Z+15 FMAX
33 M9
34 M5
35 L M140 MB MAX
36 M30
37 END PGM contour-680-2-08 MM 
