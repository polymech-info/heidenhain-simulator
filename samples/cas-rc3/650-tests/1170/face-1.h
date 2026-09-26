0  BEGIN PGM face-1 MM 
1  BLK FORM 0.1 Z  X+0  Y-70  Z-30
2  BLK FORM 0.2  X+100  Y+0  Z+0
3  ;-------------------------------------
4  ;Tools
5  ;  #23 D=80 - ZMIN=-0.5 - ZMAX=+15 - face mill
6  ;-------------------------------------
7  ;
8  * - Face1 (3)
9  M5
10 TOOL CALL 23 Z S350
11 L M140 MB MAX
12 M3
13 L  X-52  Y-35 R0 FMAX
14 L  Z+15 R0 FMAX
15 M8
16 CYCL DEF 32.0 TOLERANCE
17 CYCL DEF 32.1
18 L  Z+7.5 FMAX
19 CC  X-44  Z+7.5
20 CP IPA-90 DR- F2800
21 L  X-40.01  Z-0.5
22 L  X+140.01
23 CC  X+140.01  Z+7.5
24 CP IPA-90 DR-
25 L  X+148.01  Z+15 FMAX
26 M9
27 M5
28 L M140 MB MAX
29 M30
30 END PGM face-1 MM 
