0  BEGIN PGM pg-7s MM 
1  BLK FORM 0.1 Z  X+0  Y-210  Z-2
2  BLK FORM 0.2  X+295  Y+0  Z+0
3  ;-------------------------------------
4  ;T2 D=+2 CR=+0 - ZMIN=-2 - flat end mill
5  ;-------------------------------------
6  TOOL CALL  Z ;SET TOOL AXIS FOR M140
7  L M140 MB MAX
8  ;-------------------------------------
9  * - 2D Contour4 (16)
10 TOOL CALL 2 Z S7277
11 L M140 MB MAX
12 M3
13 L  X+150.372  Y-125.419 R0 FMAX
14 L  Z+35 R0 FMAX
15 M8
16 CYCL DEF 32.0 TOLERANCE
17 CYCL DEF 32.1
18 L  Z+8 FMAX
19 L  Z-2 F802
20 CC  X+144.879  Y-125.7
21 CP IPA+370.417 DR+ F2407
22 L  X+150.23  Y-124.431  Z+25 FMAX
23 L  X+150.379  Y-155.7 FMAX
24 L  Z+8 FMAX
25 L  Z-2 F802
26 CC  X+144.879  Y-155.7
27 CP IPA+370.417 DR+ F2407
28 L  X+150.288  Y-154.706  Z+35 FMAX
29 M9
30 M5
31 L M140 MB MAX
32 M30
33 END PGM pg-7s MM 
