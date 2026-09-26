0  BEGIN PGM fl-x1 MM 
1  BLK FORM 0.1 Z  X+0  Y-100  Z-40
2  BLK FORM 0.2  X+60  Y+0  Z+0
3  ;-------------------------------------
4  ;Tools
5  ;  #23 D=80 - ZMIN=-0.3 - ZMAX=+15 - face mill
6  ;-------------------------------------
7  ;
8  * - Face1 (3)
9  M5
10 TOOL CALL 23 Z S450
11 L M140 MB MAX
12 M3
13 L  X+30  Y+90 R0 FMAX
14 L  Z+15 R0 FMAX
15 M8
16 CYCL DEF 32.0 TOLERANCE
17 CYCL DEF 32.1
18 L  Z+7.7 FMAX
19 CC  Y+82  Z+7.7
20 CP IPA-90 DR- F460
21 L  Y-182  Z-0.3
22 CC  Y-182  Z+7.7
23 CP IPA-90 DR-
24 L  Y-190  Z+15 FMAX
25 M9
26 M5
27 L M140 MB MAX
28 M30
29 END PGM fl-x1 MM 
