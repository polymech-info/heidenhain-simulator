0  BEGIN PGM face-1 MM 
1  BLK FORM 0.1 Z  X+0  Y-85  Z-40
2  BLK FORM 0.2  X+120  Y+0  Z+0
3  ;-------------------------------------
4  ;T23 D=+80 CR=+0 - ZMIN=-1 - face mill
5  ;-------------------------------------
6  TOOL CALL  Z ;SET TOOL AXIS FOR M140
7  L M140 MB MAX
8  ;-------------------------------------
9  * - Face1
10 TOOL CALL 23 Z S5000
11 L M140 MB MAX
12 M3
13 L  X+172  Y-81.5 R0 FMAX
14 L  Z+15 R0 FMAX
15 M8
16 CYCL DEF 32.0 TOLERANCE
17 CYCL DEF 32.1
18 L  Z+7 FMAX
19 CC  X+164  Z+7
20 CP IPA+90 DR+ F1000
21 L  X+160.01  Z-1
22 L  X-40.01
23 CC  X-40.01  Y-60.03
24 CP IPA-180 DR-
25 L  X+160.01  Y-38.56
26 CC  X+160.01  Z+7
27 CP IPA-90 DR-
28 L  X+168.01  Z+15 FMAX
29 M9
30 M5
31 L M140 MB MAX
32 M30
33 END PGM face-1 MM 
