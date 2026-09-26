0  BEGIN PGM face-650-3 MM 
1  BLK FORM 0.1 Z  X+0  Y-30  Z-100
2  BLK FORM 0.2  X+650  Y+0  Z+0
3  ;-------------------------------------
4  ;T23 D=+80 CR=+0 - ZMIN=-3 - face mill
5  ;-------------------------------------
6  TOOL CALL  Z ;SET TOOL AXIS FOR M140
7  L M140 MB MAX
8  ;-------------------------------------
9  * - Face1 (2)
10 TOOL CALL 23 Z S5000
11 L M140 MB MAX
12 M3
13 L  X+702  Y-15 R0 FMAX
14 L  Z+15 R0 FMAX
15 M8
16 CYCL DEF 32.0 TOLERANCE
17 CYCL DEF 32.1
18 L  Z+6.5 FMAX
19 CC  X+694  Z+6.5
20 CP IPA+90 DR+ F1000
21 L  X+690.01  Z-1.5
22 L  X-40.01
23 L  Z-3
24 L  X+690.01
25 CC  X+690.01  Z+5
26 CP IPA-90 DR-
27 L  X+698.01  Z+15 FMAX
28 M9
29 M5
30 L M140 MB MAX
31 M30
32 END PGM face-650-3 MM 
