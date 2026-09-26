0  BEGIN PGM pocket MM 
1  BLK FORM 0.1 Z  X+0  Y-140  Z-20
2  BLK FORM 0.2  X+200  Y+0  Z+0
3  ;-------------------------------------
4  ;T27 D=+14 CR=+0 - ZMIN=-15 - flat end mill
5  ;-------------------------------------
6  TOOL CALL  Z ;SET TOOL AXIS FOR M140
7  L M140 MB MAX
8  ;-------------------------------------
9  * - 2D Contour8 (7)
10 TOOL CALL 27 Z S2801
11 L M140 MB MAX
12 M3
13 L  X+100  Y-70 R0 FMAX
14 L  Z+45 R0 FMAX
15 M8
16 CYCL DEF 32.0 TOLERANCE
17 CYCL DEF 32.1
18 L  Z+5 FMAX
19 L  Z-15 F550
20 CC  X+100  Y-69.3
21 CP IPA+90 DR+
22 L  X+100.7  Y-52.55
23 CC  X+100  Y-52.55
24 CP IPA+90 DR+
25 L  X+49.65  Y-51.85
26 L  X+46.85 F138
27 L  Y-85.35 F550
28 L  Y-88.15 F138
29 L  X+150.35 F550
30 L  X+153.15 F138
31 L  Y-54.65 F550
32 L  Y-51.85 F138
33 L  X+95 F550
34 CC  X+95  Y-53.25
35 CP IPA+90 DR+
36 L  X+93.6  Y-54.65
37 CC  Y-54.65  Z-13.6
38 CP IPA-90 DR-
39 L  Y-56.05  Z+45 FMAX
40 M9
41 M5
42 L M140 MB MAX
43 M30
44 END PGM pocket MM 
