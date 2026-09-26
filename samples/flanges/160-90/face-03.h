0  BEGIN PGM face-03 MM 
1  BLK FORM 0.1 Z  X+0  Y-90  Z-10
2  BLK FORM 0.2  X+160  Y+0  Z+0
3  ;-------------------------------------
4  ;T23 D=+80 CR=+0 - ZMIN=-0.3 - face mill
5  ;-------------------------------------
6  TOOL CALL  Z ;SET TOOL AXIS FOR M140
7  L M140 MB MAX
8  ;-------------------------------------
9  * - Face1 (6)
10 TOOL CALL 23 Z S5000
11 L M140 MB MAX
12 M3
13 L  X+218  Y-84 R0 FMAX
14 L  Z+15 R0 FMAX
15 M8
16 CYCL DEF 32.0 TOLERANCE
17 CYCL DEF 32.1
18 L  Z+7.7 FMAX
19 CC  X+210  Z+7.7
20 CP IPA+90 DR+ F1000
21 L  X-50  Z-0.3
22 CC  X-50  Z+7.7
23 CP IPA+90 DR+
24 L  X+218  Y-38.56  Z+7.7 FMAX
25 CC  X+210  Z+7.7
26 CP IPA+90 DR+ F1000
27 L  X-50  Z-0.3
28 CC  X-50  Z+7.7
29 CP IPA+90 DR+
30 L  X-58  Z+15 FMAX
31 M9
32 M5
33 L M140 MB MAX
34 M30
35 END PGM face-03 MM 
