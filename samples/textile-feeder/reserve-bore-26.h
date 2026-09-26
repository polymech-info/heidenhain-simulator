0  BEGIN PGM reserve-bore-26 MM 
1  BLK FORM 0.1 Z  X+0  Y-85  Z-30
2  BLK FORM 0.2  X+120  Y+0  Z+0
3  ;-------------------------------------
4  ;T27 D=+14 CR=+0 - ZMIN=-31 - flat end mill
5  ;-------------------------------------
6  TOOL CALL  Z ;SET TOOL AXIS FOR M140
7  L M140 MB MAX
8  ;-------------------------------------
9  * - 2D Contour3
10 TOOL CALL 27 Z S6064
11 L M140 MB MAX
12 M3
13 L  X+66  Y-42.5 R0 FMAX
14 L  Z+15 R0 FMAX
15 M8
16 CYCL DEF 32.0 TOLERANCE
17 CYCL DEF 32.1
18 L  Z+5 FMAX
19 L  Z-31 F284
20 CC  X+60  Y-42.5
21 CP IPA+360 DR+ F852
22 L  X+66  Y-42.5  Z+15 FMAX
23 M9
24 M5
25 L M140 MB MAX
26 M30
27 END PGM reserve-bore-26 MM 
